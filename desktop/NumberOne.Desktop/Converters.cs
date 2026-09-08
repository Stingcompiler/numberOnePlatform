using System.Globalization;

namespace NumberOne.Desktop;

/// <summary>
/// Inverts a bool. Needed because the password field binds IsPassword to the
/// negation of PasswordVisible, and the view model should expose the property
/// the way a human reads it, not pre-inverted for one control.
/// </summary>
public sealed class InvertedBoolConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b ? !b : value;

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b ? !b : value;
}

/// <summary>
/// Whole percent to the 0-1 fraction ProgressBar wants. The view models expose
/// percentages because that is what the design labels show; converting at the
/// binding keeps a second, divergent representation out of the model.
/// </summary>
public sealed class PercentToFractionConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is int percent ? Math.Clamp(percent / 100.0, 0, 1) : 0.0;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is double fraction ? (int)Math.Round(fraction * 100) : 0;
}

/// <summary>
/// Fill for the النظام pill: blue for online, red for flash.
///
/// Red is both the brand colour and the danger colour, so this pill leans on a
/// tint rather than a filled block - a solid red chip in a table row would read
/// as an error.
/// </summary>
public sealed class SystemTypeTintConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var online = value is true;
        var dark = Application.Current?.RequestedTheme == AppTheme.Dark;

        return online
            ? Color.FromArgb(dark ? "#244C8DFF" : "#141A56DB")
            : Color.FromArgb(dark ? "#24E74C3C" : "#14C0392B");
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>Text colour for the النظام pill, matching its tint.</summary>
public sealed class SystemTypeInkConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var online = value is true;
        var dark = Application.Current?.RequestedTheme == AppTheme.Dark;

        return online
            ? Color.FromArgb(dark ? "#4C8DFF" : "#1A56DB")
            : Color.FromArgb(dark ? "#E74C3C" : "#C0392B");
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
