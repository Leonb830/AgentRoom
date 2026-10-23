import { auth, authConfigured, signIn, signOut } from "@/auth";
import { Workspace } from "@/components/workspace";
import { ArrowUpRight, Braces, GitBranch, History, ShieldCheck, Terminal } from "lucide-react";

export const dynamic = "force-dynamic";
export default async function Home() {
  const configured = authConfigured();
  const session = configured ? await auth() : null;
  if (session?.user && session.user.id === process.env.AGENTROOM_OWNER_GITHUB_ID && configured) {
    return <Workspace owner={session.user.name ?? "Owner"} signOutAction={async () => { "use server"; await signOut({ redirectTo: "/" }); }} />;
  }
  return <main className="welcome">
    <header className="welcome-header"><a className="brand" href="/"><span className="brand-icon"><Braces size={20}/></span>AgentRoom<span className="alpha">ALPHA</span></a><span className="private-note"><ShieldCheck size={14}/> A workspace of your own</span></header>
    <section className="welcome-grid">
      <div className="welcome-copy"><div className="eyebrow"><span className="status-dot"/> YOUR PRIVATE CODING WORKSPACE</div><h1>Good work<br/>keeps going.</h1><p>Give your coding agent a task. Step away.<br className="desktop-break"/> Come back to a result you can inspect.</p>
        {configured ? <form action={async () => { "use server"; await signIn("github", { redirectTo: "/" }); }}><button className="button primary large">Continue with GitHub <ArrowUpRight size={18}/></button><small>Access is limited to the configured owner.</small></form> : <div className="setup-box"><div className="setup-label"><span className="status-dot amber"/> OWNER SETUP REQUIRED</div><h3>Your room is ready to configure.</h3><p>Set your GitHub owner and OAuth credentials in the deployment configuration to enable sign-in.</p><details><summary>View setup steps</summary><ol><li>Follow <code>docs/SETUP.md</code> in the repository.</li><li>Configure the owner username and numeric GitHub ID.</li><li>Add GitHub OAuth credentials and a session secret, then restart the web service.</li></ol></details></div>}
      </div>
      <div className="room-illustration" aria-label="Task lifecycle: brief, execution, review"><div className="grid-pattern"/><div className="orbit one"/><div className="orbit two"/><div className="room-core"><Braces size={48}/></div><div className="flow-card brief"><span className="mini-icon"><Terminal size={16}/></span><div><b>A clear brief</b><small>One task. Its own workspace.</small></div><span className="step-number">01</span></div><div className="flow-card progress"><span className="mini-icon"><History size={16}/></span><div><b>Work that persists</b><small>History stays when you leave.</small></div><span className="step-number">02</span></div><div className="flow-card result"><span className="mini-icon green"><GitBranch size={16}/></span><div><b>Changes you can inspect</b><small>Review the exact result.</small></div><span className="step-number">03</span></div><div className="illustration-caption">BRIEF → EXECUTE → REVIEW</div></div>
    </section>
    <footer className="welcome-footer"><span>One owner. One runner. Room to focus.</span><span>Powered by your coding agent <span className="footer-arrow">↗</span></span></footer>
  </main>;
}
