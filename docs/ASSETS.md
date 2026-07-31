# Assets

Everything below is CC0 — free for commercial use, no attribution required. Verify the
licence on each individual file before shipping.

## HDRI environment maps (the single biggest visual win)
Poly Haven — `polyhaven.com/hdris`. Grab 2k `.hdr`.
- one warm indoor for oak levels
- one cold overcast for ice
- one bright desert for sand

Load with `RGBELoader`, assign to `scene.environment`. The marbles will reflect it
immediately and that alone is most of the "real glass" impression.

## PBR floor textures
Poly Haven `polyhaven.com/textures` or ambientCG `ambientcg.com`. Albedo + normal +
roughness at 2k, tiling:
- oak / wood planks
- sea ice or frozen ground
- fine sand with ripples
- polished granite
- dark tinted glass

## Marbles
No models needed. `SphereGeometry(r, 48, 32)` with `MeshPhysicalMaterial` beats any
downloadable marble model, because the look comes from transmission and the environment
map rather than from geometry.

## Audio
Prefer synthesis for anything speed-driven — the rolling bed and the turbo engine note must
track velocity continuously, and no sample does that.
- freesound.org, filtered to CC0, for one-shots
- Web Audio synthesis for: rolling bed, engine voice, impacts, stingers

## Fonts
Bricolage Grotesque (display) + DM Mono (data). Both SIL Open Font License.
