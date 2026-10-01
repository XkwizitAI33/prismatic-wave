/* GitHub Pages serves 404.html for any unknown path. If the path looks like one of our views
 * (e.g. /prismatic-wave/music or /prismatic-wave/discography/echo-of-the-streets), send the visitor to the
 * matching hash route instead of showing the error page. Classic script on purpose: it runs before paint. */
(function () {
  var base = document.baseURI;                                   // <base href> = site root (set by tools/build-seo.py)
  var basePath = new URL(base).pathname;
  var path = location.pathname;
  if (path.indexOf(basePath) !== 0) return;
  var rest = path.slice(basePath.length).replace(/\/+$/, '').replace(/(^|\/)index\.html$/, '');
  if (/^(music|discography|about|connect)(\/[a-z0-9-]+)?$/i.test(rest)) {
    location.replace(base + '#/' + rest + location.search);   // ?genre=… carries over to the hash route
  }
})();
