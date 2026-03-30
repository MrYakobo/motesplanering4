# Mobile Design — Mötesplanering

## Navigation

Desktop nav has ~10 buttons in a row. On mobile, collapse to a bottom tab bar
with the 4 most-used sections + a "more" overflow.

```
┌─────────────────────────┐
│ Mötesplanering      [A] │  ← top bar: brand + avatar
├─────────────────────────┤
│                         │
│       (content)         │
│                         │
├────┬────┬────┬────┬─────┤
│ 📅 │ 👥 │ 📋 │ 🔀 │ ··· │  ← bottom tabs
│Händ│Kont│Uppg│Sche│Mer  │
└────┴────┴────┴────┴─────┘
```

"Mer" opens a sheet with: Team, Slides, Månadsblad,
Påminnelsemail, Namnskyltar, Söndag, Inställningar.


## Event List

Cards instead of table rows. Each card shows date, title,
category badge. Tap → full-screen sidebar.

```
┌─────────────────────────┐
│ [🔍 Sök...]   [+ Ny]   │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ 6 apr  10:00        │ │
│ │ Gudstjänst  [Söndag]│ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ 9 apr  19:00        │ │
│ │ Bibelstudium [Vardag]│ │
│ └─────────────────────┘ │
│         ...             │
│                         │
│    [ ↓ Idag ]           │
├────┬────┬────┬────┬─────┤
│ 📅 │ 👥 │ 📋 │ 🔀 │ ··· │
└────┴────┴────┴────┴─────┘
```


## Sidebar / Detail View

Full-screen overlay. Close button top-right.
Same fields, stacked vertically.

```
┌─────────────────────────┐
│ ← Tillbaka          [×] │
├─────────────────────────┤
│ TITEL                   │
│ [Gudstjänst           ] │
│                         │
│ DATUM        TID        │
│ [2026-04-06] [10:00   ] │
│                         │
│ KATEGORI                │
│ [Söndag           ▾]   │
│                         │
│ BESKRIVNING             │
│ [                     ] │
│ [                     ] │
│                         │
│ ── Tilldelningar ────── │
│ Predikant: Erik S.      │
│ Musik: Team Worship     │
│                         │
├─────────────────────────┤
│ [Radera]     [💾 Spara] │
└─────────────────────────┘
```


## Calendar (Month)

7-column grid, no week numbers. Compact event pills.
Tap a day → filtered list for that day.

```
┌─────────────────────────┐
│  ◀  April 2026  ▶       │
├───┬───┬───┬───┬───┬───┬───┤
│ M │ T │ O │ T │ F │ L │ S │
├───┼───┼───┼───┼───┼───┼───┤
│   │   │ 1 │ 2 │ 3 │ 4 │ 5 │
│   │   │   │   │   │   │ ▪ │
├───┼───┼───┼───┼───┼───┼───┤
│ 6 │ 7 │ 8 │ 9 │...│   │12 │
│ ▪▪│   │   │ ▪ │   │   │ ▪ │
└───┴───┴───┴───┴───┴───┴───┘
         ▪ = event dot
```


## Week View

Vertical stack of days (not 7 columns).
Each day is a section with its events listed.

```
┌─────────────────────────┐
│  Vecka 15               │
├─────────────────────────┤
│ MÅN 6 april             │
│ ┌─────────────────────┐ │
│ │ 10:00 Gudstjänst    │ │
│ └─────────────────────┘ │
│                         │
│ TIS 7 april             │
│   (inga händelser)      │
│                         │
│ ONS 8 april             │
│ ┌─────────────────────┐ │
│ │ 19:00 Bibelstudium  │ │
│ └─────────────────────┘ │
│         ...             │
└─────────────────────────┘
```


## Schedule (Monster Table)

Too wide for mobile. Two options:

**Option A — Card per event:**
Each event becomes a card showing its assignments.

```
┌─────────────────────────┐
│ 6 apr — Gudstjänst      │
├─────────────────────────┤
│ Predikant:  [Erik S. ▾] │
│ Musik:      [Team W. ▾] │
│ Ljud:       [— välj — ▾]│
│ Fika:       [Anna K. ▾] │
└─────────────────────────┘
```

**Option B — Horizontal scroll** (current, works ok
with the sticky first column already in place).

We'll go with B.


## Team Board

Stack columns vertically instead of side-by-side.
Pool at top, teams below.

```
┌─────────────────────────┐
│ [Worship] [Teknik] [Fika]│ ← tab pills, scroll
├─────────────────────────┤
│ WORSHIP (4)              │
│ ┌───────────────────┐   │
│ │ Erik Svensson     │   │
│ │ Anna Karlsson     │   │
│ │ ...               │   │
│ └───────────────────┘   │
│                         │
│ ALLA KONTAKTER          │
│ [🔍 Sök...]            │
│ ┌───────────────────┐   │
│ │ Johan Berg        │   │
│ │ Maria Holm        │   │
│ └───────────────────┘   │
└─────────────────────────┘
```


## Modals

Full-screen from bottom, no border-radius.
Close/cancel always top-right.

```
┌─────────────────────────┐
│ Generera händelser  [×] │
├─────────────────────────┤
│                         │
│  (form fields stacked)  │
│                         │
│  (preview below form,   │
│   not side-by-side)     │
│                         │
├─────────────────────────┤
│ [Avbryt]    [Generera]  │
└─────────────────────────┘
```


## Multi-select Popovers

Bottom sheet instead of dropdown.
Search field + scrollable checkbox list.

```
┌─────────────────────────┐
│       (dimmed content)  │
├─────────────────────────┤
│ [🔍 Sök person...]     │
│ ☑ Erik Svensson         │
│ ☑ Anna Karlsson         │
│ ☐ Johan Berg            │
│ ☐ Maria Holm            │
│ ☐ ...                   │
└─────────────────────────┘
```


## Summary of Breakpoints

| Width    | Layout                                    |
|----------|-------------------------------------------|
| > 768px  | Desktop — current layout, no changes      |
| ≤ 768px  | Tablet — sidebar overlay, tighter spacing |
| ≤ 480px  | Phone — bottom nav, stacked views, cards  |
