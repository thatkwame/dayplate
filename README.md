# Dayplate
A mobile-friendly calorie diary with a monthly calendar and weekly totals. No build step or account required.

## Open on your computer
Extract the ZIP and open index.html in a browser. Keep foods.js, app.js and style.css in the same folder. For regular use, open the GitHub Pages address below so your diary always uses the same address.

## Put it on GitHub Pages
1. Create a public GitHub repository, for example dayplate.
2. Upload index.html, style.css, foods.js and app.js directly to the main branch, at the top level. Commit the files.
3. Open Settings → Pages. Under Build and deployment, choose Deploy from a branch. Select main and / (root), then save.
4. Once the deployment finishes, use Visit site in Settings → Pages. Open the same address on your phone and bookmark it.

## Keeping your diary
Choose Log food or the + beside a meal. Search for your food, select a preparation and enter the portion weight in grams. Alternatively choose manual entry for calories from a packet or recipe. Select dates on the calendar to view or update previous days. The weekly chart covers Monday to Sunday. A daily goal is optional and applies across dates.

Each browser keeps its own diary. Under My data, download a backup before clearing browser data or switching devices. Restore that file on the other device to replace its diary. Backups contain your food history in plain text. Keep them private and out of the GitHub repository.

## Food data
The bundled food index comes from the [UK Composition of Foods Integrated Dataset (CoFID), 2021](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid), published by Public Health England. Contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). The index includes named foods with numeric energy values and excludes the alcoholic drinks group, whose values are per 100 ml. Dayplate multiplies kcal per 100 g by portion weight in grams, divides by 100 and rounds to the nearest whole kcal.

## Packaged foods
Choose **Scan a product** to read a retail barcode or a GS1 Digital Link QR code, upload a label photo, or enter the digits. Dayplate checks the number and retrieves nutrition data from Open Food Facts. Confirm the name, kcal and whether the pack gives values per 100 g or 100 ml. Save a portion to remember the product locally. Saved products are included in diary backups. Macro estimates in the product review use available label data. A QR code that only links to a marketing page cannot identify a food.

Product data: [Open Food Facts](https://world.openfoodfacts.org/data), Open Database Licence. Barcode decoding: [html5-qrcode 2.3.8](https://github.com/mebjas/html5-qrcode), Apache-2.0, incorporating ZXing. See scanner-LICENSE.txt.

## Connected kitchen release

- **What should I eat?** ranks recipes using available ingredient quantities, cooking time, exclusions and an optional calorie preference. Prioritise quicker meals or pantry ingredients. Available homemade batches appear first as ready-made options.
- **Flexible week** generates four meal slots per day. An optional calorie goal guides recipe choices and quarter-serving portions (0.25–3 servings); without one, recipes use one serving. Lock favourites, change recipes, move to an empty slot, adjust servings or reserve a slot for eating out. Generation preserves locked, logged and eating-out slots. Planned meals do not enter the diary until confirmed eaten.
- **Pantry and shopping** store exact food/preparation weights. The shopping list aggregates outstanding planned ingredients and subtracts pantry stock. Confirming a planned meal or creating a cooked batch deducts ingredients. Cooked ingredient weights are not converted to raw supermarket purchase weights. Pantry corrections are manual; deleting a diary entry does not undo ingredient deductions.
- **Cooked batches** snapshot nutrition from saved recipes, support scaled recipes and measured finished weight, track fridge/freezer location and remaining grams. QR labels open a specific batch; the existing scanner accepts these labels. Portions cannot exceed remaining stock. Editing/deleting a batch diary portion recalculates remaining grams. Repeating a meal or a recent food is an ordinary new diary entry, not a withdrawal from the old batch.
- All kitchen data is included in JSON backups. Older backups load with an empty kitchen. Data remains local to each browser. QR links contain only a batch identifier; another device needs a current backup restored first. QR labels do not carry nutrition or sync data.
- No AI service or paid API is used. Photo recognition, voice logging, macro-based coaching and live supermarket prices are not included. Ingredient exclusions use text matching and are not an allergen guarantee.

### Verification
Run `node smart.test.cjs`. Covers old-backup migration, fresh storage, plan generation, slot uniqueness, locked/out slots, ingredient exclusions, shopping aggregation, pantry deductions, batch accounting, overdraw rejection, QR origin checks and backup round trips. Browser checks cover suggestion display, plan logging, batch creation, QR display and portion deduction. Physical phone-camera scanning still needs device testing.

QR generation uses qrcode-generator 1.4.4 by Kazuhiko Arase, MIT licensed; see `qrcode-LICENSE.txt`. Scanning uses the existing bundled html5-qrcode library.

## Mobile interface

Four focused screens — Diary, Plan, Kitchen and Recipes — replace the long single page. Phones have persistent bottom navigation, a seven-day selector with one planning day visible at a time, larger touch targets and bottom-sheet forms. Desktop retains the full week and side-by-side diary/calendar. The diary now includes previous/next day controls and a calorie-goal progress ring. Existing data, backups and batch QR links retain their behaviour. No migration or account is required.
