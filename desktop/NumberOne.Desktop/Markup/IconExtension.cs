using Microsoft.Maui.Controls.Shapes;

namespace NumberOne.Desktop.Markup;

/// <summary>
/// Gives every icon its own geometry: <c>Data="{ui:Icon Key=IconHome}"</c>.
///
/// The icons used to be PathGeometry resources reached with StaticResource,
/// which hands every Path THE SAME OBJECT. A Geometry belongs to one shape, so
/// the second Path to ask for IconCourses took it from the first, and the
/// screen that had it lost it.
///
/// That is why the dashboard's quick-access icons were there on first open and
/// gone after any trip to another screen: the sidebar and the tiles ask for the
/// same seven keys, and so does every screen rebuilt on the way back. It is
/// also why the theme toggle stopped showing a sun and started showing
/// something else - the icons were not disappearing so much as moving.
///
/// A markup extension is evaluated once per usage rather than once per key, so
/// each Path gets a geometry of its own and nothing can take it. The dictionary
/// now holds the path data as plain strings, which are immutable and safe to
/// share; only the geometry built from them is per-element.
///
/// Building one costs parsing a short string at page construction. There are
/// forty-seven of them across the app.
/// </summary>
[ContentProperty(nameof(Key))]
public sealed class IconExtension : IMarkupExtension<Geometry>
{
    /// <summary>The key in Icons.xaml, e.g. IconHome.</summary>
    public string Key { get; set; } = "";

    public Geometry ProvideValue(IServiceProvider serviceProvider)
    {
        if (string.IsNullOrEmpty(Key)) return new PathGeometry();

        if (Application.Current?.Resources.TryGetValue(Key, out var value) != true || value is not string data)
        {
            // A missing key draws nothing rather than throwing: an icon is not
            // worth a blank screen. But it is recorded, because the failure
            // looks exactly like the bug this class exists to fix - an icon
            // that is not there - and a silent one would be indistinguishable.
            App.RecordUnhandled("Icon", new KeyNotFoundException(
                $"no path data in the resource dictionary for '{Key}'"));

            return new PathGeometry();
        }

        try
        {
            return new PathGeometryConverter().ConvertFromInvariantString(data) as Geometry
                   ?? new PathGeometry();
        }
        catch (Exception ex)
        {
            App.RecordUnhandled("Icon", new FormatException($"'{Key}' is not usable path data", ex));
            return new PathGeometry();
        }
    }

    object IMarkupExtension.ProvideValue(IServiceProvider serviceProvider)
        => ProvideValue(serviceProvider);
}
