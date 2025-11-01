// matches-service/ForwardAuthHandler.cs
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;

namespace MatchesService.Http;

public class ForwardAuthHandler : DelegatingHandler
{
    private readonly IHttpContextAccessor _http;

    public ForwardAuthHandler(IHttpContextAccessor http)
    {
        _http = http;
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        // Copia Authorization del request entrante (si existe)
        var auth = _http.HttpContext?.Request?.Headers["Authorization"].ToString();
        if (!string.IsNullOrWhiteSpace(auth))
        {
            if (AuthenticationHeaderValue.TryParse(auth, out var header))
            {
                request.Headers.Authorization = header;
            }
        }

        return base.SendAsync(request, cancellationToken);
    }
}
