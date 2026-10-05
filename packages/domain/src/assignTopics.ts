export interface TopicSlot {
  id: string;
  hours: number;
}

export interface LessonSlot {
  id: string;
  hours: number;
}

export interface TopicAssignment {
  lessonId: string;
  topicId: string | null;
}

/**
 * Розкладає теми по заняттях по черзі з урахуванням годин:
 * тема на 4 години займає два заняття по 2 години. Заняття понад план лишаються без теми.
 * Викликач передає лише теми й заняття одного виду, упорядковані за порядком/датою.
 */
export function assignTopics(
  lessons: readonly LessonSlot[],
  topics: readonly TopicSlot[],
): TopicAssignment[] {
  const queue = topics.filter((t) => t.hours > 0);
  let index = 0;
  let remaining = queue[0]?.hours ?? 0;

  return lessons.map((lesson) => {
    const topic = queue[index];
    if (!topic) return { lessonId: lesson.id, topicId: null };

    remaining -= lesson.hours;
    if (remaining <= 0) {
      index += 1;
      remaining = queue[index]?.hours ?? 0;
    }
    return { lessonId: lesson.id, topicId: topic.id };
  });
}
