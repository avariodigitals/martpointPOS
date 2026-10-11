import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MeetingBooking } from "@/components/shared/meeting-booking"

export default async function CustomerMeetingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return (
    <>
      <Header />
      <main className="flex-1 bg-background">
        <section className="container-martpoint py-16">
          <div className="max-w-2xl mx-auto">
            <MeetingBooking token={token} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
