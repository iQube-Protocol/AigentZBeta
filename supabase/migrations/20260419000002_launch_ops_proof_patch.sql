-- Launch Ops: unique partial index for proof asset templates

create unique index if not exists uq_lo_proof_template_program_code
on launch_proof_assets (
  program_id,
  (metadata->>'code')
)
where (metadata->>'template') = 'true';
