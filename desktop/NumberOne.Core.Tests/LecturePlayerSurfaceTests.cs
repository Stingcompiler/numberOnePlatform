using System.Text.RegularExpressions;

namespace NumberOne.Core.Tests;

/// <summary>
/// The lecture picture is an 11 inch 16:9 surface, and stays one in fullscreen.
///
/// This reads the view rather than exercising it because the size lives in
/// XAML, and it is here because the requirement has already been broken once.
/// Fullscreen used to clear the two size requests so the frame could fill the
/// screen; the Border sits in a VerticalStackLayout inside a ScrollView, which
/// measures a child to its content, and a WebView has no intrinsic height - so
/// the picture collapsed to a strip. What fullscreen actually removes is
/// everything AROUND the picture.
///
/// Numbers alone would not have caught that: 920 x 518 was still written in the
/// XAML the whole time. So the last test reads the fullscreen method too.
/// </summary>
public class LecturePlayerSurfaceTests
{
    private const double Dpi = 96.0;        // device-independent units per inch
    private const double Diagonal = 11.0;   // inches

    private static string DesktopFile(string relative)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);

        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "NumberOne.Desktop")))
            dir = dir.Parent;

        Assert.NotNull(dir);
        return Path.Combine(dir!.FullName, "NumberOne.Desktop", relative);
    }

    private static (int Width, int Height) Surface()
    {
        var xaml = File.ReadAllText(DesktopFile(Path.Combine("Views", "LessonView.xaml")));

        // The frame the video plays in, by name, so a size request anywhere
        // else on the page cannot be mistaken for it.
        var frame = Regex.Match(xaml, @"<Border\s+x:Name=""VideoFrame""(.*?)>", RegexOptions.Singleline);
        Assert.True(frame.Success, "LessonView.xaml no longer has a Border named VideoFrame");

        var w = Regex.Match(frame.Groups[1].Value, @"WidthRequest=""(\d+)""");
        var h = Regex.Match(frame.Groups[1].Value, @"HeightRequest=""(\d+)""");

        Assert.True(w.Success && h.Success, "VideoFrame no longer declares both a width and a height");
        return (int.Parse(w.Groups[1].Value), int.Parse(h.Groups[1].Value));
    }

    [Fact]
    public void The_picture_is_eleven_inches_corner_to_corner()
    {
        var (width, height) = Surface();

        var inches = Math.Sqrt(width * width + height * height) / Dpi;

        // Half a millimetre of tolerance: the exact surface is 920.38 x 517.72
        // units and neither rounds to a whole number cleanly.
        Assert.InRange(inches, Diagonal - 0.02, Diagonal + 0.02);
    }

    [Fact]
    public void The_picture_is_sixteen_by_nine()
    {
        var (width, height) = Surface();

        Assert.InRange(width / (double)height, 16.0 / 9.0 - 0.005, 16.0 / 9.0 + 0.005);
    }

    [Fact]
    public void Fullscreen_does_not_resize_the_picture()
    {
        var code = File.ReadAllText(DesktopFile(Path.Combine("Views", "LessonView.xaml.cs")));

        var body = Regex.Match(code, @"private void ApplyFullscreen\(bool on\)\s*\{(.*?)\n    \}",
                               RegexOptions.Singleline);
        Assert.True(body.Success, "ApplyFullscreen is no longer where this test can read it");

        // Strip the comments first: the method explains at length why it does
        // not touch these, and the explanation mentions them by name.
        var statements = Regex.Replace(body.Groups[1].Value, @"//[^\n]*", "");

        Assert.DoesNotContain("VideoFrame.WidthRequest", statements);
        Assert.DoesNotContain("VideoFrame.HeightRequest", statements);

        // And it still has to do the thing it is for: take away what surrounds
        // the picture. Without this the test would pass on a method that had
        // been emptied.
        Assert.Contains("BelowVideo.IsVisible", statements);
    }
}
