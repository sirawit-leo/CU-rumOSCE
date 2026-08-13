# CU-rumOSCE

**A 20-minute dairy-cattle OSCE station, simulated in a single offline HTML file.**

The game deals you one case out of twenty and does not tell you the diagnosis. You decide which
history questions to ask, which examinations to perform, what the animal has, which drugs to give,
and you do the dose arithmetic yourself. Everything is randomised again each round, so the same
disease never plays the same way twice.

---

> ### ⚠️ Read this first
>
> **This is a student revision aid, for education only. It is not clinical guidance.**
>
> - A **personal student project**. Not official material of any faculty or institution, and **not reviewed or endorsed by teaching staff**.
> - **Drug doses, routes and withdrawal times may be wrong, incomplete or out of date.** Verify every figure against the **product label** before any use in a live animal, under the supervision of a licensed veterinarian.
> - Some content is still unverified — see [Known gaps](#known-gaps).
> - The author accepts no liability for any loss or damage arising from use of this material.

---

## Play it

### ▶ [**sirawit-leo.github.io/CU-rumOSCE**](https://sirawit-leo.github.io/CU-rumOSCE/)

That is the whole thing. Nothing to install, nothing to sign in to.

Or download and **open `osce-game.html` in any browser**. No install, no build step, no network — the
whole thing, including the fonts, styles and images, is inside that one file, so it runs offline and
off a USB stick just as well as it runs from the link above.

```bash
git clone https://github.com/sirawit-leo/CU-rumOSCE.git
cd CU-rumOSCE
open osce-game.html      # macOS   ·   Windows: start   ·   Linux: xdg-open
```

`Space` pauses and resumes the clock. The interface is in Thai; clinical terms are in English.

---

## How it works

**Time is the currency.** You have 1,200 seconds and every action spends real time out of it.

| Action | Cost |
|---|---|
| One history question | 10 s |
| One physical examination | 20 s |
| **Auscultating the rumen at the left paralumbar fossa** | **3 min** |
| Blood smear from the ear tip | 2 min 30 s |
| Each drug drawn up and injected | 45 s |
| **Forgetting to pick up the weight tape** | **2 min** — you have to walk back and measure |

Clicking everything is not a strategy. There is a **precision score**: a player who performs forty
actions and gets six useful findings scores worse than one who performs twelve and gets ten. The
skill being trained is knowing what *not* to do. The clock never stops and **you cannot go back a
step** — when it reaches zero the station closes and you are marked on what you managed.

### The six stages

1. **Take the call** — choose from 23 history questions
2. **Triage and instruct the owner** — decide urgency, then pick what to have ready before you arrive; wrong instructions cost marks
3. **Examine** — 25 examinations and 6 cow-side tests to choose from
4. **Diagnose** — 23 diseases on the list, including decoys with no case behind them
5. **Treat** — the whole 38-item cabinet appears in random order with no filtering. Pick up to three drugs, then enter the dose in mg/kg, **calculate the volume in mL yourself**, and choose the route — for every drug you selected
6. **Talk to the owner** — milk withdrawal, **the exact date and milking round the milk may go back in the tank**, whether the disease is notifiable, and the prognosis

### Marking, out of 100

Sixty points sit on the four decisions that actually determine whether the animal lives:

| | |
|---|---|
| Triage | 12 |
| Instructions to the owner | 12 |
| Diagnosis | 20 |
| Choosing the right drug | 16 |
| **Core total** | **60** |
| History, examination, precision, dose arithmetic, route, withdrawal, notification, prognosis | 40 |

### What the game will not do for you

- It never names the disease.
- **There is no calculator.** If you want the animal's weight you have to pick up the weight tape during the examination.
- **The drug list is not filtered.** Lutalyse, xylazine, oestradiol, dexamethasone and gentamicin sit in the same random list as the right answer.
- **Red flags are scored.** Giving a dry-cow intramammary tube to a milking cow, or a prostaglandin to a pregnant animal, is caught and penalised.
- **The milk-withdrawal question can be a trap.** If the owner already treated the animal before you arrived, the governing withdrawal may be that earlier drug, not the one you just gave — but you only learn about it if you asked.

### Randomised every round

Weight, age, days in milk, pregnancy status, herd size, number affected, temperature, heart and
respiratory rate, severity tier (which changes the correct triage *and* prognosis), the date and
time of your injection, and whether the owner already gave something — all re-rolled. Re-randomising
after a case never deals you the same one twice in a row.

---

## The twenty cases

Every animal lives on a dairy farm, but not all of them are milking — some are dry cows, some are
maiden heifers, and the withdrawal advice changes accordingly.

### Major — rainy-season diseases with prominent signs

| Disease | What decides it |
|---|---|
| Babesiosis | Cola-coloured urine, pallor, icterus |
| Anaplasmosis | Severe pallor and icterus but **normal urine** |
| Trypanosomiasis (Surra) | Cool painless dependent oedema, wasting despite eating · ⚖️ notifiable |
| Haemorrhagic septicaemia | Hot painful submandibular oedema, inspiratory stridor · ⚖️ notifiable |
| Leptospirosis | Red urine plus **four flabby quarters**, flooding, rats, a sick farm worker |
| Foot rot | Symmetrical swelling above the coronary band, the smell |
| Coliform mastitis | Watery flaky milk, and a **subnormal** temperature |
| Bovine ephemeral fever | Many animals at once, stiffness, **no oral lesions** |
| Lumpy skin disease | Deep firm nodules, marked lymphadenopathy · ⚖️ notifiable |
| Dermatophilosis | Paintbrush scabs along the topline, no fever |

### Minor — the ones that could still come up

| Disease | What decides it |
|---|---|
| Milk fever | Recumbent, **subnormal** temperature, S-bend in the neck |
| Ketosis | Refuses concentrate but still eats hay, acetone breath, blood BHB |
| Rumen acidosis | Silent rumen, sour grain-flecked diarrhoea, all four feet sore |
| Hardware disease | **Positive withers pinch**, won't walk downhill |
| Bovine respiratory disease | Cranioventral lung sounds, several sick in one pen |
| Foot and mouth disease | Vesicles in the mouth, on the teats, at the coronary band · ⚖️ notifiable |
| Anthrax | Sudden death, dark unclotting blood · **do not open the carcass** · ⚖️ notifiable |
| Haemonchosis | Bottle jaw, severe pallor, **no fever** |
| Fasciolosis | Bottle jaw, snail habitat · **two of the cabinet's wormers do nothing to fluke** |
| Photosensitisation | Skin loss that stops exactly at the white-hair boundary, mouldy feed |

---

## Known gaps

Published knowing these are open. **Do not trust them without checking.**

- **Gentamicin (AAGENT 10%)** carries a **3–5 day milk withdrawal for approved intramuscular use**, and the game uses the conservative end of that range. That figure holds only on-label: **off-label use or intramammary infusion can push it to 10 days or longer**, with no single number to rely on. The 49-day meat withdrawal is the longest in the cabinet.
- The **notifiable-disease reporting window** is set to **12 hours**, following section 11 of the Animal Epidemics Act B.E. 2558. Many Thai textbooks and revision notes say 24 hours. Confirm with your instructor before an exam.
- Several products carry no printed withdrawal time at all, and the drug register and the bottle labels disagree in eight places. **Where they disagree, this project follows the bottle.**

Every unverified figure carries a **⚠️** in the interface.

---

## Provenance and credits

The drug list, strengths, doses and withdrawal times were transcribed from **photographs of the
drug cabinet and the veterinary supply register of the Dairy Research Farm, Faculty of Veterinary
Science, Chulalongkorn University**, recorded there in the course of routine work.

**The underlying records belong to the farm and to the Faculty.** They were made available to the
author for academic discussion and teaching only. The author claims no ownership of them and
**cannot grant permission for their use** — anyone wishing to cite or work with the source records
must contact the farm and the Faculty directly.

- The cabinet photographs were taken and shared by **Phawat** and **Klaophum**. 🔒 The original
  images are **not included in this repository**: they are someone else's work and they show a
  working unit's stock. What was extracted from them lives in the game.
- Clinical content is drawn from standard references (Merck Veterinary Manual, Plumb's Veterinary
  Drug Handbook) alongside the author's own revision notes for the Thai veterinary licensing exam.
- The interface is built on the design system in [`design-system/`](design-system/).

---

## Licence

[**CC BY-NC-ND 4.0**](https://creativecommons.org/licenses/by-nc-nd/4.0/) — see [`LICENSE`](LICENSE).

Study it, show it, cite it. Credit the author. **No commercial use. No modified redistribution.**

---

## Found a mistake?

Wrong clinical content is worth fixing straight away. Please
[open an issue](https://github.com/sirawit-leo/CU-rumOSCE/issues), particularly if:

- a dose, route or withdrawal time does not match the actual product label
- a diagnosis or treatment path contradicts what is taught
- a withdrawal time still marked **⚠️** in the interface is printed on a bottle you have in front of you
