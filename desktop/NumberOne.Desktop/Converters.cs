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
