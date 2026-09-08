using System.Globalization;
using NumberOne.Core.Models;

namespace NumberOne.Desktop;

/// <summary>ناجح / راسب from a pass flag.</summary>
public sealed class VerdictWordConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? "ناجح" : "راسب";

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// Verdict text colour: success or danger. Red is both the brand colour and the
/// danger colour here, which is why the verdict carries a word as well as a hue
/// — colour alone would not distinguish "failed" from "branded".
/// </summary>
public sealed class VerdictInkConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var dark = Application.Current?.RequestedTheme == AppTheme.Dark;

        return value is true
            ? Color.FromArgb(dark ? "#22C55E" : "#059669")
            : Color.FromArgb(dark ? "#E74C3C" : "#C0392B");
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>Tint fill behind the verdict circle on the result view.</summary>
public sealed class VerdictTintConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var dark = Application.Current?.RequestedTheme == AppTheme.Dark;

        return value is true
            ? Color.FromArgb(dark ? "#2422C55E" : "#14059669")
            : Color.FromArgb(dark ? "#24E74C3C" : "#14C0392B");
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>
/// Notification type to its Arabic word. Maps from the raw stored value, and
/// folds the legacy "live_podcast" onto the current live-session wording so old
/// rows do not read differently from new ones.
/// </summary>
public sealed class NotificationTypeWordConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => NotificationTypes.Display(value as string);

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>صحيحة / خاطئة on the answer sheet.</summary>
public sealed class CorrectWordConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is true ? "صحيحة" : "خاطئة";

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
