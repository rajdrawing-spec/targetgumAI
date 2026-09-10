/**
 * Placeholder landing page for Day 1 foundation scaffolding.
 *
 * This is intentionally minimal. Per the build specification
 * (docs/BRD-PRD.md, Section 116), application features are not
 * implemented until the architecture plan has been reviewed and
 * approved. The real dashboard shell arrives with the auth/RBAC
 * foundation (see docs/MVP-CHECKLIST.md).
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">TargetGum AI Marketing OS</h1>
      <p className="text-sm text-gray-500">
        Foundation scaffold. See docs/MVP-CHECKLIST.md for build status.
      </p>
    </main>
  )
}
