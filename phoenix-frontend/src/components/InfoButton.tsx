"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function InfoButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button className="secondary info-btn attn" onClick={() => setOpen(true)} aria-label="About Phoenix">
        ⓘ Info
      </button>
      {open &&
        createPortal(
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>About Project Phoenix</h2>
              <button className="secondary" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <section>
              <h3>What Phoenix does</h3>
              <p>
                Phoenix is a small project tracker for teams. People work together inside a{" "}
                <strong>workspace</strong>; a workspace holds <strong>projects</strong>; a project holds{" "}
                <strong>tasks</strong> that move from to&nbsp;do → doing → done.
              </p>
            </section>
            <section>
              <h3>How to use it</h3>
              <ul>
                <li><strong>Workspaces</strong> — pick one from the list or create your own.</li>
                <li><strong>Projects &amp; tasks</strong> — open a workspace, add a project, then add tasks to it. Search and filter tasks on the project page.</li>
                <li><strong>Credits</strong> — every new task costs 1 credit. Only the workspace <em>owner</em> can top up credits (workspace page).</li>
                <li><strong>Members</strong> — owners and admins can add teammates by email (members page). They must already have an account.</li>
                <li><strong>Roles</strong> — owner &gt; admin &gt; member. Other workspaces are private.</li>
              </ul>
              <p className="muted small">Demo logins (password <code>phoenix123</code>): alice@phoenix.dev (owner), bob@phoenix.dev (member), carol@phoenix.dev (other workspace).</p>
            </section>
            <section>
              <h3>What is broken (overview)</h3>
              <p>Nothing here has been fixed for you. At a high level, expect trouble in all three parts:</p>
              <ul>
                <li><strong>phoenix-backend</strong> — setup, database, API behaviour, security and data correctness.</li>
                <li><strong>phoenix-frontend</strong> — setup, build, and how the screens behave.</li>
                <li><strong>phoenix-ci</strong> — the GitHub pipeline, the smoke test and the Vercel deployment settings.</li>
              </ul>
              <p className="muted small">Finding the actual problems is the challenge — we will not point at them.</p>
            </section>
            <section>
              <h3>Your mission</h3>
              <p>
                This copy of Phoenix has been handed over in a broken state. Get <strong>all
                three parts</strong> — <code>phoenix-backend</code>, <code>phoenix-frontend</code> and{" "}
                <code>phoenix-ci</code> — installing, building, running and deploying correctly.
              </p>
              <ol>
                <li>Read the README in each folder; they describe the intended behaviour.</li>
                <li>Find what is wrong and fix it. We will not tell you where to look.</li>
                <li>Do not rewrite the app, and do not skip or weaken tests and checks.</li>
                <li>Write a <code>REPORT.md</code> explaining each fix in your own words.</li>
                <li>Submit your folder to the grader at <strong>http://13.233.41.22:7070/</strong> and repeat until every section is green.</li>
              </ol>
            </section>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
