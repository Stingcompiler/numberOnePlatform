using System.Text.Json;

namespace NumberOne.Core.Api;

/// <summary>
/// Pulls the human-readable message out of a DRF error body.
///
/// The shape depends on where the error was raised, and the login path uses
/// the less obvious one:
///   - ValidationError raised inside a serializer's validate()  →  {"non_field_errors": ["..."]}
///   - APIException / PermissionDenied / a view's Response      →  {"detail": "..."}
///   - ValidationError on a single field                        →  {"username": ["..."]}
/// Every login refusal in LoginSerializer.validate() lands in the first shape,
/// so a parser that only reads "detail" would show a blank error on the one
/// screen where the message carries all the meaning.
/// </summary>
public static class DrfError
{
    public static string? ExtractMessage(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            if (root.ValueKind == JsonValueKind.String)
                return root.GetString();

            if (root.ValueKind == JsonValueKind.Array)
                return FirstString(root);

            if (root.ValueKind != JsonValueKind.Object)
                return null;

            // Preferred keys, in the order that carries the most meaning.
            foreach (var key in new[] { "non_field_errors", "detail", "error" })
            {
                if (root.TryGetProperty(key, out var preferred))
                {
                    var found = Flatten(preferred);
                    if (found is not null) return found;
                }
            }

            // Fall back to the first field error, prefixed with nothing — the
            // student does not benefit from seeing the field name in Latin.
            foreach (var prop in root.EnumerateObject())
            {
                var found = Flatten(prop.Value);
                if (found is not null) return found;
            }

            return null;
        }
        catch (JsonException)
        {
            // Not JSON at all — an HTML error page from a proxy, most likely.
            return null;
        }
    }

    private static string? Flatten(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.String => element.GetString(),
        JsonValueKind.Array  => FirstString(element),
        _ => null,
    };

    private static string? FirstString(JsonElement array)
    {
        foreach (var item in array.EnumerateArray())
        {
            var value = Flatten(item);
            if (!string.IsNullOrWhiteSpace(value))
                return value;
        }
        return null;
    }
}
