# Visual hierarchy

Guidelines for laying out Guess the Date screens. The goal is one obvious thing to read and one obvious thing to do.

## Principles

- **Size and scale:** the clue is the focal point. Headings are clearly larger than body text, and the primary action is visibly the biggest control.
- **Color and contrast:** body text is near-black on white. Muted text is still at least 4.5:1. Green is reserved for the primary action and a correct answer, not for decoration.
- **Typography:** one system sans-serif. Three weights are enough: regular body, medium emphasis, bold headings. Sizes: page title, clue, body, small metadata.
- **Spacing:** tight spacing inside a group, generous space between groups. Each section gets room to breathe instead of extra borders.
- **Alignment:** a single centered column, left-aligned text, consistent padding. Nothing sits off-grid.

## Rules

1. **One focal point per screen.** The current clue leads. Metadata, attempt counts, and history stay quiet.
2. **The primary action is unmistakable.** One filled green button; everything else is plain text or an outline.
3. **Remove competing elements.** No duplicate counters, no decorative panels, no second accent color.
4. **Keep contrast.** Never use light gray for text that has to be read.
5. **Use the 60-30-10 split.** 60% white background, 30% neutral borders and muted text, 10% green accent.
6. **Respect the fold.** The clue, the date fields, and the submit button are visible without scrolling on a phone.
7. **Keep the type scale fixed.** Identical roles always get identical sizes and weights across screens.

## Type scale

| Role | Size | Weight |
|---|---|---|
| Page title | 24px | Bold |
| Clue (current) | 16px | Medium |
| Clue (older) | 14px | Regular, muted |
| Body / history | 14px | Regular |
| Metadata | 12px | Medium, muted |
| Primary button | 16px | Semibold |
