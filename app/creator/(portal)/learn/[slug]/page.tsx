import Link from "next/link"
import { notFound } from "next/navigation"
import { requireCreatorSession } from "@/lib/creator-auth"
import { getLearningBySlug, getProgressMap, markLessonStarted } from "@/lib/creator-learning"
import { LEARNING_TYPE_LABELS } from "@/lib/creator-constants"
import { LessonPlayer } from "./lesson-player"
import { AssessmentForm } from "./assessment-form"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Clock, Link2, BookOpen } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { creator } = await requireCreatorSession()
  const lesson = await getLearningBySlug(slug)
  if (!lesson) notFound()

  const progress = await getProgressMap(creator.id)
  const p = progress.get(lesson.id)

  // Record the open (marks IN_PROGRESS) — non-blocking.
  if (!p) void markLessonStarted(creator.id, lesson.id)

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/creator/learn"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Learn
      </Link>

      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
            {LEARNING_TYPE_LABELS[lesson.type]}
          </span>
          {lesson.required && (
            <span className="rounded-full bg-retail-soft text-retail px-2 py-0.5 font-medium">
              Required
            </span>
          )}
          {lesson.durationSeconds != null && lesson.durationSeconds > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {Math.round(lesson.durationSeconds / 60)} min
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{lesson.title}</h2>
        {lesson.description && (
          <p className="text-muted-foreground mt-2">{lesson.description}</p>
        )}
      </div>

      {lesson.type === "ASSESSMENT" ? (
        <AssessmentForm contentId={lesson.id} />
      ) : (
        <>
          <LessonPlayer
            contentId={lesson.id}
            type={lesson.type}
            videoUrl={lesson.videoUrl}
            externalUrl={lesson.externalUrl}
            completed={p?.status === "COMPLETED"}
            initialPct={p?.progressPct ?? 0}
          />

          {lesson.body && (
            <Card>
              <CardContent className="p-6">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {lesson.body}
                </div>
              </CardContent>
            </Card>
          )}

          {lesson.relatedLinks.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-retail" /> Related resources
                </p>
                <ul className="space-y-2">
                  {lesson.relatedLinks.map((l) => (
                    <li key={l.url}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-retail hover:underline"
                      >
                        <Link2 className="h-3.5 w-3.5" /> {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
