# The World Today — Tuesday, 17 November 2026

[![news-image-20261117](https://make.fun/badge/news-image-20261117.svg)](https://make.fun/bounty/news-image-20261117)
[![rank](https://make.fun/badge/news-image-20261117/deriharyanto1/news-image-20261117/rank.svg)](https://make.fun/bounty/news-image-20261117)
[![reward](https://make.fun/badge/news-image-20261117/deriharyanto1/news-image-20261117/reward.svg)](https://make.fun/bounty/news-image-20261117)

A one-page newspaper front page summing up the world's news of
**Tuesday, 17 November 2026**, drawn entirely in code.

## The image

`main.ts` (Node 22, standard library only) draws the whole front page —
masthead, date, top story, six illustrated panels and a briefs strip —
with a hand-rolled vector stroke font and a hand-written PNG encoder,
and writes it to `/output/entry.png` (1024×1024).

Top story: **U.S. STRIKES IRAN** — US warplanes hit a missile site on
Qeshm Island after Iranian attacks on Bahrain and ships in the Strait of
Hormuz. Also inside: the Kerch Bridge hit again, the Trump–Xi–Putin summit
in Shenzhen, the US losing its measles elimination status, the nationwide
American blackout, the Gaza aid call, and Japan scrambling jets.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The program is deterministic: two runs write byte-identical PNGs.

## Competition

[news-image-20261117 on make.fun](https://make.fun/bounty/news-image-20261117)
