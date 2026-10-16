import {beforeEach,describe,expect,it,vi} from "vitest"
const db=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),deps:[] as Array<{business_id:string;environment_url:string}>,error:null as unknown}))
vi.mock("@/lib/supabase",()=>({supabase:{from:db.from,rpc:db.rpc},isSupabaseConfigured:()=>true}))
vi.mock("@/lib/automations",()=>({getAutomationByKey:vi.fn(),enqueueAutomation:vi.fn(),getClientCheckinConfig:vi.fn(),sendClientCheckinEmail:vi.fn()}))
import {enrolInstall,installationRoot} from "@/lib/install-enrolment"
import {recordInstallCheckin,retentionState} from "@/lib/client-checkins"
import {POST as enrolRoute} from "@/app/api/usage/enroll/route"
import {POST as pingRoute} from "@/app/api/usage/ping/route"
const key="k".repeat(64)
beforeEach(()=>{
 vi.unstubAllEnvs();vi.unstubAllGlobals();db.deps=[{business_id:"one",environment_url:"https://client.example.com/shop/"}];db.error=null;db.rpc.mockReset();db.rpc.mockResolvedValue({data:"t".repeat(64),error:null});
 db.from.mockImplementation(()=>{const chain:Record<string,unknown>={select:()=>chain,insert:()=>chain,then:(resolve:(r:unknown)=>unknown)=>Promise.resolve({data:db.deps,error:db.error}).then(resolve)};return chain})
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({verified:true})}))
})
describe("private automatic enrolment",()=>{
 it("verifies only with trusted Central and returns the existing token",async()=>{
  expect(await enrolInstall("https://client.example.com/shop/",key)).toBe("t".repeat(64))
  expect(fetch).toHaveBeenCalledWith("https://central.martpoint.com.ng/fleet/verify_usage_install",expect.objectContaining({method:"POST",redirect:"error",cache:"no-store"}))
  expect(db.rpc).toHaveBeenCalledWith("issue_install_checkin_token",{p_business_id:"one",p_rotate:false})
 })
 it("rejects a different folder even on the same hostname",async()=>{expect(await enrolInstall("https://client.example.com/another/",key)).toBeNull();expect(fetch).not.toHaveBeenCalled()})
 it("rejects a deployment assigned to two businesses",async()=>{db.deps.push({...db.deps[0],business_id:"two"});expect(await enrolInstall(db.deps[0].environment_url,key)).toBeNull();expect(fetch).not.toHaveBeenCalled()})
 it("never accepts an invalid private fleet proof",async()=>{vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({verified:false})} as Response);expect(await enrolInstall(db.deps[0].environment_url,key)).toBeNull();expect(db.rpc).not.toHaveBeenCalled()})
 it("fails closed on Central failure without issuing credentials",async()=>{vi.mocked(fetch).mockRejectedValue(new Error("offline"));expect(await enrolInstall(db.deps[0].environment_url,key)).toBeNull();expect(db.rpc).not.toHaveBeenCalled()})
 it("rejects untrusted redirects and non-HTTPS verifier configuration",async()=>{vi.stubEnv("FLEET_CENTRAL_URL","http://internal/");expect(await enrolInstall(db.deps[0].environment_url,key)).toBeNull();expect(fetch).not.toHaveBeenCalled()})
 it("does not fall back to public marketing URLs or malformed roots",()=>{expect(installationRoot("https://u:p@client.example.com")).toBeNull();expect(installationRoot("https://client.example.com/?x=1")).toBeNull();expect(installationRoot("https://CLIENT.example.com/shop")).toBe("https://client.example.com/shop/")})
 it("keeps private responses out of caches",async()=>{const res=await enrolRoute(new Request("https://admin.test/api/usage/enroll",{method:"POST",body:JSON.stringify({install_url:db.deps[0].environment_url,install_key:key})}));expect(res.headers.get("Cache-Control")).toBe("no-store");expect((await res.json()).token).toBe("t".repeat(64))})
 it("rejects oversized enrolment payloads",async()=>{const res=await enrolRoute(new Request("https://admin.test/api/usage/enroll",{method:"POST",body:"x".repeat(4100)}));expect(res.status).toBe(413);expect(fetch).not.toHaveBeenCalled()})
})
describe("genuine retention events",()=>{
 it("sends original login time to atomic persistence",async()=>{db.rpc.mockResolvedValue({data:true,error:null});const login=new Date(Date.now()-40*86400000).toISOString();expect(await recordInstallCheckin({token:key,type:"system",loginAt:login,systemAt:new Date().toISOString()})).toEqual({matched:true});expect(db.rpc).toHaveBeenCalledWith("record_install_retention",expect.objectContaining({p_login_at:login,p_activity_at:null}));})
 it("rejects a fabricated future login",async()=>{expect(await recordInstallCheckin({token:key,loginAt:new Date(Date.now()+3600000).toISOString()})).toEqual({matched:false});expect(db.rpc).not.toHaveBeenCalled()})
 it("does not accept usage timestamps on a system-only event",async()=>{expect(await recordInstallCheckin({token:key,type:"system",activityAt:new Date().toISOString()})).toEqual({matched:false});expect(db.rpc).not.toHaveBeenCalled()})
 it("requires a private token for login attribution",async()=>{expect(await recordInstallCheckin({key:"https://client.example.com",loginAt:new Date().toISOString()})).toEqual({matched:false});expect(db.rpc).not.toHaveBeenCalled()})
 it("does not acknowledge unsuccessful persistence",async()=>{db.rpc.mockResolvedValue({data:false,error:null});expect(await recordInstallCheckin({token:key,activityAt:new Date().toISOString()})).toEqual({matched:false})})
 it("parses server-to-server login/activity from the installed reporter",async()=>{db.rpc.mockResolvedValue({data:true,error:null});const login=new Date().toISOString();const res=await pingRoute(new Request("https://admin.test/api/usage/ping",{method:"POST",body:JSON.stringify({token:key,type:"usage",login_at:login,activity_at:login})}));expect((await res.json()).matched).toBe(true);expect(db.rpc).toHaveBeenCalledWith("record_install_retention",expect.objectContaining({p_login_at:login,p_activity_at:login,p_system_at:null}))})
 it("accepts private token headers without dropping event timestamps",async()=>{db.rpc.mockResolvedValue({data:true,error:null});const login=new Date().toISOString();const res=await pingRoute(new Request("https://admin.test/api/usage/ping",{method:"POST",headers:{"x-install-token":key},body:JSON.stringify({login_at:login,activity_at:login})}));expect((await res.json()).matched).toBe(true);expect(db.rpc).toHaveBeenCalledWith("record_install_retention",expect.objectContaining({p_token:key,p_login_at:login}))})
 it("does not invent login evidence for legacy installations",()=>{expect(retentionState(null)).toEqual({daysSinceLogin:null,retentionStatus:"no_login_recorded"})})
 it("marks exactly 30 days without login as at risk",()=>{const now=Date.now();expect(retentionState(new Date(now-30*86400000).toISOString(),now)).toEqual({daysSinceLogin:30,retentionStatus:"at_risk"});expect(retentionState(new Date(now-29*86400000).toISOString(),now).retentionStatus).toBe("active")})
})
