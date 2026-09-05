using System.Globalization;

namespace NumberOne.Desktop;

/// <summary>
/// Theme-aware colour lookup for the converters below.
///
/// A converter cannot use AppThemeBinding — it returns a value, not a binding —
/// so it resolves the Light/Dark pair itself against the theme in force. Every
/// converted colour must go through here rather than hard-coding a hex, or the
/// dark theme silently keeps the light palette.
/// </summary>
internal static class ThemeColors
{
    public static Color Get(string token)
    {
        var key = token + (Application.Current?.RequestedTheme == AppTheme.Dark ? "Dark" : "Light");

        return Application.Current?.Resources.TryGetValue(key, out var value) == true
            ? (Color)value
            : Colors.Transparent;
    }

    public static Color Text => Get("Text");
    public static Color TextSecondary => Get("TextSecondary");
    public static Color TextMuted => Get("TextMuted");
    public static Color Primary => Get("Primary");
    public static Color Secondary => Get("Secondary");
    public static Color Success => Get("Success");
    public static Color Warning => Get("Warning");
    public static Color Danger => Get("Danger");
    public static Color Hover => Get("Hover");
    public static Color Border => Get("Border");
    public static Color BorderStrong => Get("BorderStrong");
    public static Color PrimaryTint => Get("PrimaryTint");
    public static Color WarningTint => Get("WarningTint");
    public static Color DisabledText => Get("DisabledText");
    public static Color DisabledBg => Get("DisabledBg");
}

/// <summary>
/// Success where the week produced something, secondary where it did not.
///
/// "+٥ هذا الأسبوع" in green and "لا جديد هذا الأسبوع" in green would read as
/// the same news; the colour is carrying the difference, not the wording.
/// </summary>
public sealed class GainInkConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? ThemeColors.Success : ThemeColors.TextSecondary;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>The banner dot: danger while a session is live, warning while it is pending.</summary>
public sealed class LiveDotConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => new SolidColorBrush(value is true ? ThemeColors.Danger : ThemeColors.Warning);

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>The status text beside it, in the same two colours.</summary>
public sealed class LiveInkConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? ThemeColors.Primary : ThemeColors.Warning;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// The face an unread notification's title takes: medium while unread, regular
/// once read. Takes IsRead, so the sense is inverted here rather than adding a
/// second property to the DTO for one binding.
///
/// Returns a family name, not FontAttributes. The design's emphasis here is
/// 500, and FontAttributes can only ask for bold — which MAUI would synthesise
/// over the 400 outline, landing heavier than the section heading above it.
/// </summary>
public sealed class UnreadWeightConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => Fonts.Resolve(value is true ? "FontUi" : "FontUiMedium");

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// Font family names, resolved from Tokens.xaml rather than spelled out.
///
/// The aliases live in one place so swapping a face is one edit; a converter
/// hard-coding "Cairo" would quietly survive that edit and diverge.
/// </summary>
internal static class Fonts
{
    public static string Resolve(string token)
        => Application.Current?.Resources.TryGetValue(token, out var value) == true
            ? (string)value
            : "";
}

/// <summary>
/// Fill for a live session's status pill, keyed on the raw status string.
///
/// live → primary tint, upcoming → warning tint, ended and archived → the
/// hover grey. A finished session is not a failure and must not read as one.
/// </summary>
public sealed class LiveStatusTintConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => (value as string) switch
        {
            Core.Models.LiveStatuses.Live => ThemeColors.PrimaryTint,
            Core.Models.LiveStatuses.Upcoming => ThemeColors.WarningTint,
            _ => ThemeColors.Hover,
        };

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>Ink for that pill.</summary>
public sealed class LiveStatusInkConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => (value as string) switch
        {
            Core.Models.LiveStatuses.Live => ThemeColors.Danger,
            Core.Models.LiveStatuses.Upcoming => ThemeColors.Warning,
            _ => ThemeColors.TextMuted,
        };

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// The join control's ink and border. A session that cannot be joined keeps its
/// control — stating "انتهت" where the link would be — but drops to muted so it
/// does not invite a click that leads nowhere.
/// </summary>
public sealed class JoinableInkConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? ThemeColors.Text : ThemeColors.TextMuted;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

public sealed class JoinableBorderConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? ThemeColors.BorderStrong : ThemeColors.Border;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// The provider glyph, chosen from the raw provider string. The geometries are
/// the design's own; see Icons.xaml.
/// </summary>
public sealed class ProviderIconConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var key = (value as string) switch
        {
            Core.Models.LiveProviders.Zoom => "IconZoom",
            Core.Models.LiveProviders.GoogleMeet => "IconGoogleMeet",
            Core.Models.LiveProviders.Teams => "IconTeams",
            Core.Models.LiveProviders.YouTube => "IconYouTube",
            _ => "IconLink",
        };

        return Application.Current?.Resources.TryGetValue(key, out var geometry) == true
            ? geometry
            : null;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// Fill for a selected tab or filter chip. Selection is carried by a filled
/// secondary tint and a strong border, not by a colour change alone.
/// </summary>
public sealed class SelectedTabTintConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? ThemeColors.Get("SecondaryTint") : Colors.Transparent;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

public sealed class SelectedTabInkConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? ThemeColors.Secondary : ThemeColors.TextSecondary;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

public sealed class SelectedTabBorderConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? ThemeColors.Secondary : ThemeColors.Border;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// Ink for a lesson row: success once complete, plain text otherwise. Applied
/// to the title, so a finished lecture reads as finished at a glance down the
/// unit rather than only by the trailing marker.
/// </summary>
public sealed class CompletedInkConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? ThemeColors.TextSecondary : ThemeColors.Text;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// Resolves an Icons.xaml key to its geometry, so a view model can name an icon
/// without referencing MAUI's shape types.
///
/// It used to hand back whatever the dictionary held, which worked while that
/// was a PathGeometry. The dictionary holds path data as strings now - so that
/// each Path can own its geometry rather than share one - and returning a
/// string here would have set nothing on the blocked-account screen, quietly,
/// on the one screen nobody opens on purpose.
/// </summary>
public sealed class IconKeyConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is string key ? Markup.IconExtension.Resolve(key) : null;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// Amber only when something is owed. A settled balance takes the ordinary ink,
/// because a warning colour on a figure that needs no action teaches a student
/// to ignore the colour.
/// </summary>
public sealed class BalanceInkConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? ThemeColors.Warning : ThemeColors.Text;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// Dims a control that has nowhere to go — the pager arrows at either end.
/// Disabling alone leaves them looking live, and removing them makes the pager
/// jump about as the page changes.
/// </summary>
public sealed class EnabledOpacityConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? 1.0 : 0.4;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// True when a count is zero — the "this room has no sessions" case.
///
/// Binding IsVisible to a count and inverting it in XAML is not possible in
/// MAUI, and adding an IsEmpty to the DTO for one row would put a display
/// concern into a serialisation type.
/// </summary>
public sealed class ZeroToTrueConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is int count && count == 0;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// The accordion chevron: down while open, pointing along the reading direction
/// while closed. In RTL that is leftward, which is why the closed glyph is
/// IconChevronLeft and not the "back" chevron.
/// </summary>
public sealed class ExpandChevronConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var key = value is true ? "IconChevronDown" : "IconChevronLeft";

        return Application.Current?.Resources.TryGetValue(key, out var geometry) == true
            ? geometry
            : null;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// The 0-1 fraction to a width, against a track measured at binding time.
/// MAUI has no percentage width, so the design's fill bars are sized from the
/// track's own measured width via a multi-binding on this.
/// </summary>
public sealed class FractionToWidthConverter : IMultiValueConverter
{
    public object Convert(object?[]? values, Type targetType, object? parameter, CultureInfo culture)
    {
        if (values is not { Length: 2 }) return 0.0;

        var fraction = values[0] switch
        {
            double d => d,
            int i => i / 100.0,
            _ => 0.0,
        };

        var width = values[1] is double w && w > 0 ? w : 0.0;

        return Math.Clamp(fraction, 0, 1) * width;
    }

    public object[] ConvertBack(object? value, Type[] targetTypes, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
