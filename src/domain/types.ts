export type Id = string;
export type ISODate = string;
export type Role = 'teacher' | 'student';
export interface User {
  id: Id;
  name: string;
  role: Role;
  email: string;
}
export interface Subject {
  id: Id;
  ownerId: Id;
  name: string;
  course: string;
  year: number;
  description: string;
  code: string | null;
  status: 'active' | 'archived';
  archivedAt?: ISODate;
}
export interface Membership {
  id: Id;
  subjectId: Id;
  studentId: Id;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  requestedAt: ISODate;
  decidedAt?: ISODate;
}
export interface Choice {
  id: Id;
  text: string;
}
interface QuestionBase {
  id: Id;
  prompt: string;
  points: number;
  explanation?: string;
  hint?: string;
  manual?: boolean;
  groupId?: Id;
  manualGuide?: string;
}
export type Question =
  | (QuestionBase & { type: 'single'; options: Choice[]; correctOptionId: Id })
  | (QuestionBase & { type: 'multiple'; options: Choice[]; correctOptionIds: Id[] })
  | (QuestionBase & { type: 'true-false'; correct: boolean })
  | (QuestionBase & { type: 'matching'; left: Choice[]; right: Choice[]; pairs: Record<Id, Id> })
  | (QuestionBase & { type: 'ordering'; items: Choice[]; correctOrder: Id[] })
  | (QuestionBase & {
      type: 'fill-options';
      template: string;
      blanks: { id: Id; options: Choice[]; correctOptionId: Id }[];
    })
  | (QuestionBase & {
      type: 'fill-text';
      template: string;
      blanks: { id: Id; label: string }[];
      manual: true;
    })
  | (QuestionBase & { type: 'open'; manual: true });
export type AnswerValue =
  | { type: 'single'; optionId: Id }
  | { type: 'multiple'; optionIds: Id[] }
  | { type: 'true-false'; value: boolean }
  | { type: 'matching'; pairs: Record<Id, Id> }
  | { type: 'ordering'; itemIds: Id[] }
  | { type: 'fill-options'; choices: Record<Id, Id> }
  | { type: 'fill-text'; texts: Record<Id, string> }
  | { type: 'open'; text: string };
export type Block =
  | { id: Id; type: 'heading'; text: string; level: 2 | 3 }
  | { id: Id; type: 'text'; text: string }
  | { id: Id; type: 'list'; items: string[]; ordered: boolean }
  | { id: Id; type: 'image'; url: string; alt: string; caption?: string }
  | { id: Id; type: 'video'; url: string; title: string }
  | { id: Id; type: 'quiz'; questions: Question[] };
export interface Resource {
  id: Id;
  ownerId: Id;
  title: string;
  kind: 'resource' | 'quiz';
  blocks: Block[];
  editorDocument?: unknown[];
  revision: number;
  updatedAt: ISODate;
}
export interface ResourceVersion {
  id: Id;
  resourceId: Id;
  ownerId: Id;
  number: number;
  title: string;
  blocks: Block[];
  editorDocument?: unknown[];
  publishedAt: ISODate;
}
export type FeedbackPolicy = 'immediate' | 'after-close' | 'hidden';
export interface ActivitySettings {
  purpose: 'practice' | 'exam';
  pace: 'individual' | 'guided';
  maxGrade: number;
  weight: number;
  countsTowardAverage: boolean;
  maxAttempts: number;
  opensAt: ISODate;
  closesAt: ISODate;
  timeLimitMinutes: number | null;
  timeZone: string;
  feedback: FeedbackPolicy;
  manualCorrection: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  streaks: boolean;
  sound: boolean;
  ranking: boolean;
  teams: boolean;
  allowHint: boolean;
  allowDouble: boolean;
  bonusAffectsGrade: boolean;
  reportVisibility: boolean;
}
export interface Activity {
  id: Id;
  subjectId: Id;
  versionId: Id;
  title: string;
  settings: ActivitySettings;
  createdAt: ISODate;
  lockedAt?: ISODate;
  guided?: {
    status: 'waiting' | 'running' | 'closed';
    questionIndex: number;
    questionOpen: boolean;
    studentIds: Id[];
  };
}
export interface Rational {
  numerator: number;
  denominator: number;
}
export interface AnswerReview {
  revision: number;
  points: Rational;
  actorId: Id | 'automatic';
  at: ISODate;
  comment: string;
  reason?: string;
}
export interface Answer {
  questionId: Id;
  value: AnswerValue;
  idempotencyKey: string;
  submittedAt: ISODate;
  usedDouble: boolean;
  reviews: AnswerReview[];
}
export type AttemptCloseReason =
  'submitted' | 'expired' | 'guided-complete' | 'removed' | 'archived' | 'teacher-ended';
export interface Attempt {
  id: Id;
  activityId: Id;
  studentId: Id;
  versionId: Id;
  number: number;
  questionOrder: Id[];
  optionOrders: Record<Id, Id[]>;
  startedAt: ISODate;
  deadline: ISODate;
  answers: Answer[];
  status: 'in-progress' | 'closed';
  closedAt?: ISODate;
  closeReason?: AttemptCloseReason;
  resolution?: 'evaluate' | 'exclude';
}
export interface PowerupUse {
  activityId: Id;
  studentId: Id;
  kind: 'hint' | 'double';
  questionId: Id;
  attemptId: Id;
  at: ISODate;
}
export interface Evaluation {
  id: Id;
  activityId: Id;
  subjectId: Id;
  studentId: Id;
  source: 'quiz' | 'task' | 'manual';
  attemptId?: Id;
  submissionId?: Id;
  revision: number;
  grade: number;
  maxGrade: number;
  weight: number;
  countsTowardAverage: boolean;
  comment: string;
  reason?: string;
  actorId: Id;
  createdAt: ISODate;
  publishedAt: ISODate;
  answerRevisions?: Record<Id, number>;
}
export interface Task {
  id: Id;
  subjectId: Id;
  title: string;
  instructions: string;
  opensAt: ISODate;
  closesAt: ISODate;
  maxGrade: number;
  weight: number;
  countsTowardAverage: boolean;
  allowLate: boolean;
}
/** Metadata only in the prototype. Private file bytes need the future Storage adapter. */
export interface SubmissionFile {
  id: Id;
  name: string;
  size: number;
  mimeType: string;
  objectKey?: string;
}
export interface TaskSubmission {
  id: Id;
  taskId: Id;
  studentId: Id;
  version: number;
  files: SubmissionFile[];
  note: string;
  submittedAt: ISODate;
  late: boolean;
  grade?: number;
  comment?: string;
  gradedAt?: ISODate;
  publishedAt?: ISODate;
}
export interface ManualActivity {
  id: Id;
  subjectId: Id;
  title: string;
  description: string;
  occursAt: ISODate;
  maxGrade: number;
  weight: number;
  countsTowardAverage: boolean;
}
export interface HelpPreference {
  userId: Id;
  version: number;
  status: 'offered' | 'skipped' | 'completed';
}
export interface DemoState {
  schemaVersion: 1;
  revision: number;
  users: User[];
  subjects: Subject[];
  memberships: Membership[];
  resources: Resource[];
  versions: ResourceVersion[];
  activities: Activity[];
  attempts: Attempt[];
  powerups: PowerupUse[];
  evaluations: Evaluation[];
  tasks: Task[];
  submissions: TaskSubmission[];
  manualActivities: ManualActivity[];
  helpPreferences: HelpPreference[];
}
export interface OperationContext {
  now: ISODate;
  id: Id;
  actorId: Id;
}
export interface Mutation<T> {
  state: DemoState;
  result: T;
}
/** Student payloads intentionally omit private scoring fields. Demo storage itself is not a security boundary. */
export type StudentQuestion = Question extends infer Q
  ? Q extends Question
    ? Omit<
        Q,
        | 'correctOptionId'
        | 'correctOptionIds'
        | 'correct'
        | 'pairs'
        | 'correctOrder'
        | 'manualGuide'
        | 'explanation'
        | 'hint'
        | 'blanks'
      > &
        (Q extends { blanks: infer B }
          ? { blanks: B extends Array<infer I> ? Omit<I, 'correctOptionId'>[] : never }
          : object)
    : never
  : never;
export type StudentBlock =
  Exclude<Block, { type: 'quiz' }> | { id: Id; type: 'quiz'; questions: StudentQuestion[] };
export interface StudentActivity {
  activity: Activity;
  title: string;
  blocks: StudentBlock[];
  editorDocument?: unknown[];
  questions: StudentQuestion[];
  attempt: (Omit<Attempt, 'answers'> & { answers: Omit<Answer, 'reviews'>[] }) | null;
  attemptsRemaining: number;
  hintUsed: boolean;
  doubleUsed: boolean;
}
export interface AttemptScore {
  basePoints: number;
  bonusPoints: number;
  gamePoints: number;
  maximumPoints: number;
  pending: number;
  complete: boolean;
  grade: number | null;
}
export interface StudentResult {
  activityId: Id;
  title: string;
  grade: number | null;
  maxGrade: number;
  status: 'not-started' | 'in-progress' | 'pending-review' | 'unpublished' | 'published';
  publishedAt?: ISODate;
  reviewVisible: boolean;
  answers?: {
    questionId: Id;
    points: number;
    maximum: number;
    explanation?: string;
    comment?: string;
  }[];
}
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
