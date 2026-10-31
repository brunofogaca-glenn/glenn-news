diff --git a/app/page.tsx b/app/page.tsx
--- a/app/page.tsx
+++ b/app/page.tsx
@@
-        <section className="mt-7 border-b-2 border-slate-950 pb-7 md:mt-9">
-          <div className="grid gap-6 md:grid-cols-[1.5fr_0.9fr] md:items-end">
-            <div>
-              <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-orange-700">
-                Morgonens redaktion
-              </div>
-              <h2 className="max-w-4xl font-serif text-3xl font-black leading-[1.03] tracking-[-0.025em] md:text-5xl">
-                Färre nyheter. Bättre läsning.
-              </h2>
-            </div>
-            <p className="font-serif text-base leading-7 text-slate-600 md:text-lg">
-              Glenn News sammanfattar nyhetsläget och väljer ut det som
-              faktiskt är värt din tid. Krönikor, analyser, intervjuer och
-              reportage väger tyngre än ännu en kort nyhetsnotis.
-            </p>
-          </div>
-        </section>
+        <section className="editorial-overview mt-7 border-y-2 border-slate-950 py-5 md:mt-9 md:py-7">
+          <div className="flex flex-wrap items-center justify-between gap-3">
+            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-800">Glenn News · Dagens överblick</div>
+            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Redaktionell sammanfattning</div>
+          </div>
+          <h2 className="mt-3 max-w-5xl font-serif text-3xl font-black leading-[1.08] tracking-[-0.025em] md:text-5xl">
+            Dagens viktigaste – samlat på ett ställe.
+          </h2>
+          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.65fr)_minmax(220px,0.7fr)] md:items-start">
+            <div className="font-serif text-base leading-7 text-slate-700 md:text-lg md:leading-8">
+              Glenn News samlar dagens viktigaste nyheter från Borås, Sverige och världen – tillsammans med sport, ekonomi och kultur. Urvalet är oförändrat: här möts de mest relevanta nyheterna och texterna som ger sammanhang, perspektiv och något mer än bara snabba rubriker.
+            </div>
+            <div className="grid grid-cols-2 gap-3 border-t border-slate-300 pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
+              <div><div className="font-serif text-3xl font-black tabular-nums">{totalArticles}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Utvalda artiklar</div></div>
+              <div><div className="font-serif text-3xl font-black tabular-nums">{sections.length}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Nyhetsområden</div></div>
+            </div>
+          </div>
+        </section>
@@
-              {section.summary && (
-                <div className="grid gap-5 border-b border-slate-300 pb-6 md:grid-cols-[0.22fr_1fr]">
-                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
-                    Nyhetsläget
-                  </div>
-                  <p className="max-w-4xl font-serif text-lg leading-8 text-slate-800 md:text-xl">
-                    {section.summary}
-                  </p>
-                </div>
-              )}
-
@@
-                      className="group overflow-hidden border-b border-slate-300 pb-6"
+                      className={"news-story-card group overflow-hidden border-b border-slate-300 pb-5 " + (index === 0 ? "news-story-lead" : index % 5 === 4 ? "news-story-wide" : "news-story-standard")}
@@
-                        {story.aiSummary && (
-                          <p className="mobile-article-summary mt-3 font-serif text-base leading-7 text-slate-600">
-                            {story.aiSummary}
-                          </p>
-                        )}
-
diff --git a/app/globals.css b/app/globals.css
--- a/app/globals.css
+++ b/app/globals.css
@@
-  main .md\\:min-w-\\[520px\\] {
-    min-width: 0;
-  }
@@
 }
+
+/* Newspaper-inspired homepage: varied story sizes, denser tablet reading. */
+.editorial-overview {
+  background: linear-gradient(105deg, rgba(255,255,255,.48), rgba(236,231,216,.52));
+  padding-left: clamp(1rem, 2.5vw, 2rem);
+  padding-right: clamp(1rem, 2.5vw, 2rem);
+}
+main .news-story-card { align-self: start; content-visibility: auto; contain-intrinsic-size: 360px; }
+@media (min-width: 768px) {
+  main .news-story-card.news-story-lead { grid-column: span 2; }
+  main .news-story-lead > div:first-child { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(240px,.85fr); align-items:center; gap:1.25rem; }
+  main .news-story-lead .mobile-article-media { aspect-ratio:16/9; }
+  main .news-story-card.news-story-wide { grid-column:span 2; display:grid; grid-template-columns:minmax(240px,.95fr) minmax(0,1.05fr); align-items:center; gap:1.15rem; padding-bottom:1.1rem; }
+  main .news-story-wide > div:first-child { overflow:hidden; }
+  main .news-story-wide .mobile-article-media { aspect-ratio:16/9; }
+}
+@media (min-width: 640px) and (max-width: 1100px) {
+  main .news-story-card { padding-bottom:.85rem; }
+  main .news-story-lead > div:first-child { grid-template-columns:minmax(0,1.1fr) minmax(210px,.9fr); gap:.85rem; }
+  main .news-story-lead .mobile-article-title { font-size:clamp(1.15rem,2vw,1.55rem); line-height:1.16; }
+  main .news-story-wide { grid-template-columns:minmax(180px,.85fr) minmax(0,1.15fr) !important; }
+  main .news-story-card .pt-4 { padding-top:.65rem; }
+}
+@media (min-width: 768px) and (max-width: 900px) {
+  main .news-story-card.news-story-lead, main .news-story-card.news-story-wide { grid-column:span 2; }
+  main .news-story-lead > div:first-child { grid-template-columns:minmax(0,1.1fr) minmax(190px,.9fr) !important; }
+  main .news-story-wide { grid-template-columns:minmax(180px,.85fr) minmax(0,1.15fr) !important; }
+}
+@media (max-width: 639px) { main .news-story-card { padding-bottom:1rem; } }
