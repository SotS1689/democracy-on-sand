# Built on Sand

A one-page site with charts showing two things:

1. No U.S. president has ever won a majority of **voting-age adults**. 41 of 60 winners won a majority of the votes cast, but 0 of 60 won a majority of all adults. The highest was Grant in 1868, at 42.6%.
2. Congress keeps getting reelected no matter how unpopular it is. Average approval since 1974 is 29%, and the average House reelection rate is 94%.

## Data

`data.js` is built from the spreadsheets in
`Documents\Resources\Practical Theology\Politics\Democracy` (and its `Voting` folder):

```
python tools/build_data.py   # rebuild data.js after editing the spreadsheets
python tools/make_icons.py   # redraw icons and the link-preview image
```

After changing any file, bump `VERSION` in `sw.js` so installed copies update.

## Run locally

```
python -m http.server 8765
```
Then open http://localhost:8765.

## Deploy

Plain static files. Meant for GitHub Pages at `https://taylordrummond.org/democracy-on-sand/` (not published yet).
