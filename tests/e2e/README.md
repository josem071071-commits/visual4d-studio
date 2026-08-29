# Planned v0.1 end-to-end test

The end-to-end test will be implemented after the persistence layer and renderer are wired.

Required flow:
Create demo institution -> create Identity v1 -> upload demo logo/banner -> mark master -> create 1080x1920 flyer -> analyze -> approve -> structure -> approve -> resolve resources -> approve -> art direction -> approve -> solve layout -> render -> deterministic verify -> computational verify -> multimodal verify -> approve -> final -> export PNG/PDF.

The test MUST fail when a date changes, a master asset is modified, an asset crosses institution boundaries, a stage is skipped, an AI-generated image is classified as documentary, format is not 1080x1920, or a critical verification error does not block FINAL.
