import {beforeEach,expect,it,vi} from "vitest"
import React from "react"
import {renderToStaticMarkup} from "react-dom/server"
import {writeFileSync,readFileSync,mkdirSync,readdirSync} from "node:fs"
const fixture=vi.hoisted(()=>({index:0,data:{config:{welcomeEnabled:true,dormantEnabled:false,founderName:"Fixture Founder",founderEmail:"founder@example.test",signatureImageUrl:"",milestoneTemplates:[]},automation:{id:"fixture",enabled:true,delayDays:30,intervalDays:30,maxSteps:7},clients:[{id:"one",businessName:"Fixture Garden",contactName:"Fixture Owner",email:"owner@example.test",status:"ACTIVE",connectedAt:"2026-01-01",daysUsing:60,lastUsageAt:"2026-10-16",lastLoginAt:"2026-09-01",daysSinceLogin:45,retentionStatus:"at_risk",renewalDate:"2026-11-01",subscriptionAmount:240000,subscriptionCurrency:"NGN",subscriptionInterval:"ANNUAL",lastSystemPingAt:"2026-10-16",connectionStatus:"recently_active",dormancyPaused:false,token:"fixture-private-token-do-not-use",dormantLast:null,run:null}],issues:[]}}))
vi.mock("react",async(importOriginal)=>{const actual=await importOriginal<typeof import("react")>();return {...actual,useState:(initial:unknown)=>{const n=fixture.index++;return actual.useState(n===0?fixture.data:n===1?false:initial)}}})
import Page from "@/app/admin/(protected)/settings/client-checkins/page"
beforeEach(()=>{fixture.index=0;vi.stubGlobal("React",React)})
it("presents retention before email configuration and distinguishes a continuing session",()=>{
 const html=renderToStaticMarkup(<Page />)
 expect(html).toContain("At risk · no login for 30 days")
 expect(html).toContain("Recent signed-in activity — may be a continuing session")
 expect(html).toContain("2026-11-01")
 expect(html).toContain("NGN")
 expect(html.indexOf("Your clients")).toBeLessThan(html.indexOf(">Sequence<"))
 expect(html).toContain("No login in 30 days (1)")
 if(process.env.MP_RETENTION_PREVIEW==="1"){
  const dir="/private/tmp/martpoint-retention-preview";mkdirSync(dir,{recursive:true})
  const css=readdirSync(".next/static/chunks").filter((f)=>f.endsWith(".css")).map((f)=>readFileSync(".next/static/chunks/"+f,"utf8")).join("\n")
  writeFileSync(dir+"/index.html",'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Retention preview — fictional data</title><style>'+css+'</style></head><body style="padding:24px;font-family:system-ui;max-width:1400px;margin:auto">'+html+'</body></html>')
 }
})
