import { notFound } from 'next/navigation'
import { getStarterLesson, STARTER_LESSONS } from '@/lib/tryit/starter-content'
import { StarterLesson } from '@/components/tryit/starter-lesson'

export function generateStaticParams() {
  return STARTER_LESSONS.map((l) => ({ lessonId: l.id }))
}

/** A public try-it lesson. Unknown ids 404 rather than rendering an empty player. */
export default async function StartLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  if (!getStarterLesson(lessonId)) notFound()
  return <StarterLesson lessonId={lessonId} />
}
