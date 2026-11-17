import type { EducationCategory, TermId, TopicDetail } from '@/types'

import { EDUCATION_TOPICS_PART1 } from './education-topics-part1'
import { EDUCATION_TOPICS_PART2 } from './education-topics-part2'

export type { EducationCategory, TopicDetail }

export const EDUCATION_TOPICS: Record<TermId, TopicDetail> = {
  ...EDUCATION_TOPICS_PART1,
  ...EDUCATION_TOPICS_PART2,
}
