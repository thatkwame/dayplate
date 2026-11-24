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
