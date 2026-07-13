// Canonicalize on https://pdfandme.com. The apex serves the static app;
// www and the *.workers.dev URLs 301 to it (path + query preserved).
// workers.dev can't get a zone-level redirect rule — it isn't a zone we
// own — so the redirect lives here and runs before assets are served.
export default {
  fetch(request, env) {
    const url = new URL(request.url)
    const host = url.hostname
    if (host !== 'pdfandme.com' && (host === 'www.pdfandme.com' || host.endsWith('.workers.dev'))) {
      url.hostname = 'pdfandme.com'
      url.protocol = 'https:'
      url.port = ''
      return Response.redirect(url.toString(), 301)
    }
    return env.ASSETS.fetch(request)
  },
}
