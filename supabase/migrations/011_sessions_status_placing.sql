alter table if exists sessions
  drop constraint if exists sessions_status_check;

alter table if exists sessions
  add constraint sessions_status_check
  check (
    status in (
      'onboarding',
      'generating',
      'designing',
      'placing',
      'configuring',
      'checkout',
      'ordered'
    )
  );
