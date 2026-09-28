-- Modelo relacional 1.0: tablas privadas y restricciones estructurales.

create schema if not exists app;

revoke all on schema app from public, anon, authenticated;

grant usage on schema app to authenticated, service_role;

create table app.profiles (
  id uuid not null,
  display_name varchar(120) not null,
  role varchar(16) not null,
  created_at timestamptz not null default now(),
  primary key (id)
);

alter table app.profiles enable row level security;

create table app.subjects (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  name varchar(120) not null,
  course_label varchar(80) not null,
  school_year smallint not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  purge_started_at timestamptz,
  primary key (id)
);

alter table app.subjects enable row level security;

create table app.invitation_codes (
  id uuid not null default gen_random_uuid(),
  subject_id uuid not null,
  code varchar(8) not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (id),
  unique (code)
);

alter table app.invitation_codes enable row level security;

create table app.join_requests (
  id uuid not null default gen_random_uuid(),
  invitation_id uuid not null,
  student_id uuid not null,
  status varchar(16) not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  primary key (id)
);

alter table app.join_requests enable row level security;

create table app.memberships (
  id uuid not null default gen_random_uuid(),
  subject_id uuid not null,
  student_id uuid not null,
  status varchar(16) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  unique (subject_id, student_id)
);

alter table app.memberships enable row level security;

create table app.membership_events (
  id uuid not null default gen_random_uuid(),
  membership_id uuid not null,
  request_id uuid,
  actor_id uuid not null,
  event_type varchar(16) not null,
  reason text,
  occurred_at timestamptz not null default now(),
  primary key (id)
);

alter table app.membership_events enable row level security;

create table app.help_progress (
  profile_id uuid not null,
  guide_key varchar(40) not null,
  guide_version integer not null,
  state varchar(16) not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, guide_key, guide_version)
);

alter table app.help_progress enable row level security;

create table app.file_objects (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  bucket varchar(63) not null,
  object_path text not null,
  original_name varchar(255) not null,
  mime_type varchar(120) not null,
  byte_size bigint not null,
  sha256 varchar(64),
  state varchar(20) not null,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  primary key (id),
  unique (bucket, object_path)
);

alter table app.file_objects enable row level security;

create table app.resources (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  kind varchar(16) not null,
  title varchar(120) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id)
);

alter table app.resources enable row level security;

create table app.resource_drafts (
  resource_id uuid not null,
  revision bigint not null,
  schema_version integer not null,
  document jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (resource_id)
);

alter table app.resource_drafts enable row level security;

create table app.draft_files (
  resource_id uuid not null,
  file_id uuid not null,
  primary key (resource_id, file_id)
);

alter table app.draft_files enable row level security;

create table app.resource_versions (
  id uuid not null default gen_random_uuid(),
  resource_id uuid not null,
  version_no integer not null,
  title varchar(120) not null,
  published_at timestamptz not null default now(),
  content_schema_version integer not null,
  primary key (id),
  unique (resource_id, version_no)
);

alter table app.resource_versions enable row level security;

create table app.question_groups (
  version_id uuid not null,
  group_key uuid not null,
  position integer not null,
  primary key (version_id, group_key),
  unique (version_id, position)
);

alter table app.question_groups enable row level security;

create table app.content_blocks (
  version_id uuid not null,
  block_key uuid not null,
  group_key uuid,
  position integer not null,
  kind varchar(16) not null,
  body jsonb not null,
  file_id uuid,
  alt_text text,
  external_url text,
  primary key (version_id, block_key),
  unique (version_id, position)
);

alter table app.content_blocks enable row level security;

create table app.questions (
  version_id uuid not null,
  question_key uuid not null,
  group_key uuid not null,
  position integer not null,
  kind varchar(24) not null,
  prompt jsonb not null,
  max_points numeric(10,2) not null,
  correction_mode varchar(16) not null,
  primary key (version_id, question_key),
  unique (version_id, group_key, position)
);

alter table app.questions enable row level security;

create table app.question_items (
  version_id uuid not null,
  question_key uuid not null,
  item_key uuid not null,
  parent_item_key uuid,
  kind varchar(16) not null,
  position integer not null,
  label text not null,
  primary key (version_id, question_key, item_key),
  unique (version_id, question_key, position)
);

alter table app.question_items enable row level security;

create table app.question_secrets (
  version_id uuid not null,
  question_key uuid not null,
  manual_guide text,
  feedback text,
  hint text,
  primary key (version_id, question_key)
);

alter table app.question_secrets enable row level security;

create table app.item_solutions (
  version_id uuid not null,
  question_key uuid not null,
  item_key uuid not null,
  is_correct boolean,
  target_item_key uuid,
  expected_position integer,
  primary key (version_id, question_key, item_key)
);

alter table app.item_solutions enable row level security;

create table app.activities (
  id uuid not null default gen_random_uuid(),
  subject_id uuid not null,
  kind varchar(16) not null,
  version_id uuid,
  title varchar(120) not null,
  instructions text,
  opens_at timestamptz,
  closes_at timestamptz,
  occurs_on date,
  timezone varchar(64) not null,
  max_grade numeric(10,2),
  weight numeric(10,2),
  counts_for_average boolean not null,
  published_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (id)
);

alter table app.activities enable row level security;

create table app.quiz_settings (
  activity_id uuid not null,
  purpose varchar(16) not null,
  pacing varchar(16) not null,
  attempt_limit integer not null,
  duration_seconds integer,
  manual_closed_questions boolean not null,
  feedback_policy varchar(16) not null,
  shuffle_groups boolean not null,
  shuffle_options boolean not null,
  teams_enabled boolean not null,
  ranking_enabled boolean not null,
  streaks_enabled boolean not null,
  sound_allowed boolean not null,
  hint_enabled boolean not null,
  double_enabled boolean not null,
  bonus_affects_grade boolean not null,
  visibility_tracking boolean not null,
  primary key (activity_id)
);

alter table app.quiz_settings enable row level security;

create table app.task_settings (
  activity_id uuid not null,
  allow_late boolean not null,
  primary key (activity_id)
);

alter table app.task_settings enable row level security;

create table app.participants (
  id uuid not null default gen_random_uuid(),
  activity_id uuid not null,
  membership_id uuid not null,
  alias_no integer not null,
  room_joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (activity_id, membership_id),
  unique (activity_id, alias_no)
);

alter table app.participants enable row level security;

create table app.deadline_extensions (
  id uuid not null default gen_random_uuid(),
  activity_id uuid not null,
  participant_id uuid,
  new_deadline timestamptz not null,
  actor_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (id)
);

alter table app.deadline_extensions enable row level security;

create table app.guided_sessions (
  activity_id uuid not null,
  started_at timestamptz,
  closed_at timestamptz,
  close_reason varchar(20),
  revision bigint not null,
  primary key (activity_id)
);

alter table app.guided_sessions enable row level security;

create table app.session_questions (
  activity_id uuid not null,
  position integer not null,
  version_id uuid not null,
  question_key uuid not null,
  opened_at timestamptz,
  closed_at timestamptz,
  primary key (activity_id, position),
  unique (activity_id, version_id, question_key)
);

alter table app.session_questions enable row level security;

create table app.attempts (
  id uuid not null default gen_random_uuid(),
  participant_id uuid not null,
  attempt_no integer not null,
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason varchar(24),
  request_key uuid not null,
  primary key (id),
  unique (participant_id, attempt_no),
  unique (request_key)
);

alter table app.attempts enable row level security;

create table app.attempt_questions (
  id uuid not null default gen_random_uuid(),
  attempt_id uuid not null,
  version_id uuid not null,
  question_key uuid not null,
  position integer not null,
  item_order jsonb not null,
  primary key (id),
  unique (attempt_id, position),
  unique (attempt_id, version_id, question_key)
);

alter table app.attempt_questions enable row level security;

create table app.responses (
  attempt_question_id uuid not null,
  request_key uuid not null,
  payload_hash varchar(64) not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  primary key (attempt_question_id),
  unique (request_key)
);

alter table app.responses enable row level security;

create table app.question_grades (
  id uuid not null default gen_random_uuid(),
  attempt_question_id uuid not null,
  revision_no integer not null,
  points_num numeric not null,
  points_den numeric not null,
  method varchar(16) not null,
  actor_id uuid,
  comment text,
  reason text,
  engine_version varchar(32) not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (attempt_question_id, revision_no)
);

alter table app.question_grades enable row level security;

create table app.attempt_resolutions (
  attempt_id uuid not null,
  decision varchar(16) not null,
  actor_id uuid not null,
  reason text not null,
  decided_at timestamptz not null,
  primary key (attempt_id)
);

alter table app.attempt_resolutions enable row level security;

create table app.teams (
  id uuid not null default gen_random_uuid(),
  activity_id uuid not null,
  name varchar(80) not null,
  primary key (id),
  unique (activity_id, name)
);

alter table app.teams enable row level security;

create table app.team_members (
  participant_id uuid not null,
  team_id uuid not null,
  primary key (participant_id)
);

alter table app.team_members enable row level security;

create table app.powerup_uses (
  participant_id uuid not null,
  kind varchar(16) not null,
  attempt_question_id uuid not null,
  request_key uuid not null,
  consumed_at timestamptz not null default now(),
  primary key (participant_id, kind),
  unique (request_key)
);

alter table app.powerup_uses enable row level security;

create table app.submissions (
  id uuid not null default gen_random_uuid(),
  participant_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (id),
  unique (participant_id)
);

alter table app.submissions enable row level security;

create table app.submission_versions (
  id uuid not null default gen_random_uuid(),
  submission_id uuid not null,
  version_no integer not null,
  received_at timestamptz not null default now(),
  deadline_used timestamptz not null,
  resubmission_window_id uuid,
  late boolean not null,
  request_key uuid not null,
  primary key (id),
  unique (submission_id, version_no),
  unique (request_key)
);

alter table app.submission_versions enable row level security;

create table app.submission_files (
  submission_version_id uuid not null,
  file_id uuid not null,
  position smallint not null,
  primary key (submission_version_id, file_id),
  unique (submission_version_id, position)
);

alter table app.submission_files enable row level security;

create table app.resubmission_windows (
  id uuid not null default gen_random_uuid(),
  participant_id uuid not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  actor_id uuid not null,
  reason text,
  revoked_at timestamptz,
  primary key (id)
);

alter table app.resubmission_windows enable row level security;

create table app.evaluation_revisions (
  id uuid not null default gen_random_uuid(),
  participant_id uuid not null,
  revision_no integer not null,
  source_kind varchar(24) not null,
  attempt_id uuid,
  submission_version_id uuid,
  grade numeric(10,2) not null,
  feedback text,
  reason text,
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  primary key (id),
  unique (participant_id, revision_no)
);

alter table app.evaluation_revisions enable row level security;

create table app.evaluation_question_grades (
  evaluation_id uuid not null,
  question_grade_id uuid not null,
  primary key (evaluation_id, question_grade_id)
);

alter table app.evaluation_question_grades enable row level security;

create table app.integrity_events (
  id uuid not null default gen_random_uuid(),
  attempt_id uuid not null,
  client_event_key uuid not null,
  hidden_at timestamptz not null,
  visible_at timestamptz,
  received_at timestamptz not null default now(),
  primary key (id),
  unique (attempt_id, client_event_key)
);

alter table app.integrity_events enable row level security;

create table app.incident_reviews (
  attempt_id uuid not null,
  status varchar(24) not null,
  actor_id uuid,
  comment text,
  reviewed_at timestamptz,
  primary key (attempt_id)
);

alter table app.incident_reviews enable row level security;

create table app.activity_events (
  id uuid not null default gen_random_uuid(),
  activity_id uuid not null,
  actor_id uuid,
  event_type varchar(40) not null,
  details jsonb not null,
  occurred_at timestamptz not null default now(),
  primary key (id)
);

alter table app.activity_events enable row level security;

create table app.subject_events (
  id uuid not null default gen_random_uuid(),
  subject_id uuid not null,
  actor_id uuid not null,
  event_type varchar(16) not null,
  occurred_at timestamptz not null default now(),
  primary key (id)
);

alter table app.subject_events enable row level security;

create table app.purge_jobs (
  id uuid not null default gen_random_uuid(),
  subject_id uuid,
  due_at timestamptz not null,
  status varchar(16) not null,
  phase varchar(24) not null,
  retry_count integer not null,
  last_error_code varchar(64),
  next_retry_at timestamptz,
  completed_at timestamptz,
  primary key (id)
);

alter table app.purge_jobs enable row level security;

alter table app.profiles add constraint profiles_fk_0 foreign key (id) references auth.users (id) on delete restrict;

alter table app.subjects add constraint subjects_fk_0 foreign key (owner_id) references app.profiles (id) on delete restrict;

create index subjects_fk_0_idx on app.subjects (owner_id);

alter table app.invitation_codes add constraint invitation_codes_fk_0 foreign key (subject_id) references app.subjects (id) on delete cascade;

create index invitation_codes_fk_0_idx on app.invitation_codes (subject_id);

alter table app.join_requests add constraint join_requests_fk_0 foreign key (invitation_id) references app.invitation_codes (id) on delete cascade;

create index join_requests_fk_0_idx on app.join_requests (invitation_id);

alter table app.join_requests add constraint join_requests_fk_1 foreign key (student_id) references app.profiles (id) on delete restrict;

create index join_requests_fk_1_idx on app.join_requests (student_id);

alter table app.join_requests add constraint join_requests_fk_2 foreign key (decided_by) references app.profiles (id) on delete restrict;

create index join_requests_fk_2_idx on app.join_requests (decided_by);

alter table app.memberships add constraint memberships_fk_0 foreign key (subject_id) references app.subjects (id) on delete cascade;

alter table app.memberships add constraint memberships_fk_1 foreign key (student_id) references app.profiles (id) on delete restrict;

create index memberships_fk_1_idx on app.memberships (student_id);

alter table app.membership_events add constraint membership_events_fk_0 foreign key (membership_id) references app.memberships (id) on delete cascade;

create index membership_events_fk_0_idx on app.membership_events (membership_id);

alter table app.membership_events add constraint membership_events_fk_1 foreign key (request_id) references app.join_requests (id) on delete cascade;

create index membership_events_fk_1_idx on app.membership_events (request_id);

alter table app.membership_events add constraint membership_events_fk_2 foreign key (actor_id) references app.profiles (id) on delete restrict;

create index membership_events_fk_2_idx on app.membership_events (actor_id);

alter table app.help_progress add constraint help_progress_fk_0 foreign key (profile_id) references app.profiles (id) on delete cascade;

alter table app.file_objects add constraint file_objects_fk_0 foreign key (owner_id) references app.profiles (id) on delete restrict;

create index file_objects_fk_0_idx on app.file_objects (owner_id);

alter table app.resources add constraint resources_fk_0 foreign key (owner_id) references app.profiles (id) on delete restrict;

create index resources_fk_0_idx on app.resources (owner_id);

alter table app.resource_drafts add constraint resource_drafts_fk_0 foreign key (resource_id) references app.resources (id) on delete cascade;

alter table app.draft_files add constraint draft_files_fk_0 foreign key (resource_id) references app.resource_drafts (resource_id) on delete cascade;

alter table app.draft_files add constraint draft_files_fk_1 foreign key (file_id) references app.file_objects (id) on delete restrict;

create index draft_files_fk_1_idx on app.draft_files (file_id);

alter table app.resource_versions add constraint resource_versions_fk_0 foreign key (resource_id) references app.resources (id) on delete restrict;

alter table app.question_groups add constraint question_groups_fk_0 foreign key (version_id) references app.resource_versions (id) on delete cascade;

alter table app.content_blocks add constraint content_blocks_fk_0 foreign key (version_id) references app.resource_versions (id) on delete cascade;

alter table app.content_blocks add constraint content_blocks_fk_1 foreign key (version_id, group_key) references app.question_groups (version_id, group_key) on delete restrict;

create index content_blocks_fk_1_idx on app.content_blocks (version_id, group_key);

alter table app.content_blocks add constraint content_blocks_fk_2 foreign key (file_id) references app.file_objects (id) on delete restrict;

create index content_blocks_fk_2_idx on app.content_blocks (file_id);

alter table app.questions add constraint questions_fk_0 foreign key (version_id, group_key) references app.question_groups (version_id, group_key) on delete cascade;

alter table app.question_items add constraint question_items_fk_0 foreign key (version_id, question_key) references app.questions (version_id, question_key) on delete cascade;

alter table app.question_items add constraint question_items_fk_1 foreign key (version_id, question_key, parent_item_key) references app.question_items (version_id, question_key, item_key) on delete restrict;

create index question_items_fk_1_idx on app.question_items (version_id, question_key, parent_item_key);

alter table app.question_secrets add constraint question_secrets_fk_0 foreign key (version_id, question_key) references app.questions (version_id, question_key) on delete cascade;

alter table app.item_solutions add constraint item_solutions_fk_0 foreign key (version_id, question_key, item_key) references app.question_items (version_id, question_key, item_key) on delete cascade;

alter table app.item_solutions add constraint item_solutions_fk_1 foreign key (version_id, question_key, target_item_key) references app.question_items (version_id, question_key, item_key) on delete restrict;

create index item_solutions_fk_1_idx on app.item_solutions (version_id, question_key, target_item_key);

alter table app.activities add constraint activities_fk_0 foreign key (subject_id) references app.subjects (id) on delete cascade;

create index activities_fk_0_idx on app.activities (subject_id);

alter table app.activities add constraint activities_fk_1 foreign key (version_id) references app.resource_versions (id) on delete restrict;

create index activities_fk_1_idx on app.activities (version_id);

alter table app.quiz_settings add constraint quiz_settings_fk_0 foreign key (activity_id) references app.activities (id) on delete cascade;

alter table app.task_settings add constraint task_settings_fk_0 foreign key (activity_id) references app.activities (id) on delete cascade;

alter table app.participants add constraint participants_fk_0 foreign key (activity_id) references app.activities (id) on delete cascade;

alter table app.participants add constraint participants_fk_1 foreign key (membership_id) references app.memberships (id) on delete cascade;

create index participants_fk_1_idx on app.participants (membership_id);

alter table app.deadline_extensions add constraint deadline_extensions_fk_0 foreign key (activity_id) references app.activities (id) on delete cascade;

create index deadline_extensions_fk_0_idx on app.deadline_extensions (activity_id);

alter table app.deadline_extensions add constraint deadline_extensions_fk_1 foreign key (participant_id) references app.participants (id) on delete cascade;

create index deadline_extensions_fk_1_idx on app.deadline_extensions (participant_id);

alter table app.deadline_extensions add constraint deadline_extensions_fk_2 foreign key (actor_id) references app.profiles (id) on delete restrict;

create index deadline_extensions_fk_2_idx on app.deadline_extensions (actor_id);

alter table app.guided_sessions add constraint guided_sessions_fk_0 foreign key (activity_id) references app.quiz_settings (activity_id) on delete cascade;

alter table app.session_questions add constraint session_questions_fk_0 foreign key (activity_id) references app.guided_sessions (activity_id) on delete cascade;

alter table app.session_questions add constraint session_questions_fk_1 foreign key (version_id, question_key) references app.questions (version_id, question_key) on delete restrict;

create index session_questions_fk_1_idx on app.session_questions (version_id, question_key);

alter table app.attempts add constraint attempts_fk_0 foreign key (participant_id) references app.participants (id) on delete cascade;

alter table app.attempt_questions add constraint attempt_questions_fk_0 foreign key (attempt_id) references app.attempts (id) on delete cascade;

alter table app.attempt_questions add constraint attempt_questions_fk_1 foreign key (version_id, question_key) references app.questions (version_id, question_key) on delete restrict;

create index attempt_questions_fk_1_idx on app.attempt_questions (version_id, question_key);

alter table app.responses add constraint responses_fk_0 foreign key (attempt_question_id) references app.attempt_questions (id) on delete cascade;

alter table app.question_grades add constraint question_grades_fk_0 foreign key (attempt_question_id) references app.attempt_questions (id) on delete cascade;

alter table app.question_grades add constraint question_grades_fk_1 foreign key (actor_id) references app.profiles (id) on delete restrict;

create index question_grades_fk_1_idx on app.question_grades (actor_id);

alter table app.attempt_resolutions add constraint attempt_resolutions_fk_0 foreign key (attempt_id) references app.attempts (id) on delete cascade;

alter table app.attempt_resolutions add constraint attempt_resolutions_fk_1 foreign key (actor_id) references app.profiles (id) on delete restrict;

create index attempt_resolutions_fk_1_idx on app.attempt_resolutions (actor_id);

alter table app.teams add constraint teams_fk_0 foreign key (activity_id) references app.activities (id) on delete cascade;

alter table app.team_members add constraint team_members_fk_0 foreign key (participant_id) references app.participants (id) on delete cascade;

alter table app.team_members add constraint team_members_fk_1 foreign key (team_id) references app.teams (id) on delete cascade;

create index team_members_fk_1_idx on app.team_members (team_id);

alter table app.powerup_uses add constraint powerup_uses_fk_0 foreign key (participant_id) references app.participants (id) on delete cascade;

alter table app.powerup_uses add constraint powerup_uses_fk_1 foreign key (attempt_question_id) references app.attempt_questions (id) on delete cascade;

create index powerup_uses_fk_1_idx on app.powerup_uses (attempt_question_id);

alter table app.submissions add constraint submissions_fk_0 foreign key (participant_id) references app.participants (id) on delete cascade;

alter table app.submission_versions add constraint submission_versions_fk_0 foreign key (submission_id) references app.submissions (id) on delete cascade;

alter table app.submission_versions add constraint submission_versions_fk_1 foreign key (resubmission_window_id) references app.resubmission_windows (id) on delete cascade;

create index submission_versions_fk_1_idx on app.submission_versions (resubmission_window_id);

alter table app.submission_files add constraint submission_files_fk_0 foreign key (submission_version_id) references app.submission_versions (id) on delete cascade;

alter table app.submission_files add constraint submission_files_fk_1 foreign key (file_id) references app.file_objects (id) on delete restrict;

create index submission_files_fk_1_idx on app.submission_files (file_id);

alter table app.resubmission_windows add constraint resubmission_windows_fk_0 foreign key (participant_id) references app.participants (id) on delete cascade;

create index resubmission_windows_fk_0_idx on app.resubmission_windows (participant_id);

alter table app.resubmission_windows add constraint resubmission_windows_fk_1 foreign key (actor_id) references app.profiles (id) on delete restrict;

create index resubmission_windows_fk_1_idx on app.resubmission_windows (actor_id);

alter table app.evaluation_revisions add constraint evaluation_revisions_fk_0 foreign key (participant_id) references app.participants (id) on delete cascade;

alter table app.evaluation_revisions add constraint evaluation_revisions_fk_1 foreign key (attempt_id) references app.attempts (id) on delete cascade;

create index evaluation_revisions_fk_1_idx on app.evaluation_revisions (attempt_id);

alter table app.evaluation_revisions add constraint evaluation_revisions_fk_2 foreign key (submission_version_id) references app.submission_versions (id) on delete cascade;

create index evaluation_revisions_fk_2_idx on app.evaluation_revisions (submission_version_id);

alter table app.evaluation_revisions add constraint evaluation_revisions_fk_3 foreign key (actor_id) references app.profiles (id) on delete restrict;

create index evaluation_revisions_fk_3_idx on app.evaluation_revisions (actor_id);

alter table app.evaluation_question_grades add constraint evaluation_question_grades_fk_0 foreign key (evaluation_id) references app.evaluation_revisions (id) on delete cascade;

alter table app.evaluation_question_grades add constraint evaluation_question_grades_fk_1 foreign key (question_grade_id) references app.question_grades (id) on delete cascade;

create index evaluation_question_grades_fk_1_idx on app.evaluation_question_grades (question_grade_id);

alter table app.integrity_events add constraint integrity_events_fk_0 foreign key (attempt_id) references app.attempts (id) on delete cascade;

alter table app.incident_reviews add constraint incident_reviews_fk_0 foreign key (attempt_id) references app.attempts (id) on delete cascade;

alter table app.incident_reviews add constraint incident_reviews_fk_1 foreign key (actor_id) references app.profiles (id) on delete restrict;

create index incident_reviews_fk_1_idx on app.incident_reviews (actor_id);

alter table app.activity_events add constraint activity_events_fk_0 foreign key (activity_id) references app.activities (id) on delete cascade;

create index activity_events_fk_0_idx on app.activity_events (activity_id);

alter table app.activity_events add constraint activity_events_fk_1 foreign key (actor_id) references app.profiles (id) on delete restrict;

create index activity_events_fk_1_idx on app.activity_events (actor_id);

alter table app.subject_events add constraint subject_events_fk_0 foreign key (subject_id) references app.subjects (id) on delete cascade;

create index subject_events_fk_0_idx on app.subject_events (subject_id);

alter table app.subject_events add constraint subject_events_fk_1 foreign key (actor_id) references app.profiles (id) on delete restrict;

create index subject_events_fk_1_idx on app.subject_events (actor_id);

alter table app.purge_jobs add constraint purge_jobs_fk_0 foreign key (subject_id) references app.subjects (id) on delete set null;

create index purge_jobs_fk_0_idx on app.purge_jobs (subject_id);

revoke all on all tables in schema app from public, anon, authenticated;

grant all on all tables in schema app to service_role;
