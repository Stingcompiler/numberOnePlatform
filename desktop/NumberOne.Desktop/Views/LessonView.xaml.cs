using NumberOne.Core.Abstractions;
using NumberOne.Core.Models;
using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

public partial class LessonView : ContentView
{
    private readonly LessonViewModel _vm;
    private readonly IWindowProtection _protection;

    private IDispatcherTimer? _watermarkTimer;
    private int _ticksSinceMove;

    /// <summary>
    /// Seconds between watermark repositions. The design says 15-20; a fixed 17
    /// sits inside that and keeps the movement from syncing with anything the
    /// student could time.
    /// </summary>
    private const int MoveEverySeconds = 17;

    public LessonView(LessonViewModel vm, IWindowProtection protection)
    {
        InitializeComponent();

        _vm = vm;
        _protection = protection;
        BindingContext = vm;

        // The notice must not claim protection the platform does not provide.
        // On macOS, and on Windows builds older than 2004, capture blocking is
        // simply absent and saying otherwise would be a lie to the student.
        SecurityNotice.Text = (protection.IsSupported
            ? "التسجيل والتقاط الشاشة معطّلان لحماية المحتوى"
            : "هذا المحتوى محمي بحقوق النشر — التسجيل أو إعادة النشر مخالفة.")
            + " · 920 × 518";

        SecurePlayer();

        // The attachment opens in the system handler, outside the app. A second
        // WebView showing the same material would not carry the player window's
        // capture protection, and would quietly become the way around it.
        vm.BrowserLauncher = async url =>
        {
            try
            {
                await Launcher.Default.OpenAsync(url);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        };
    }

    public LessonViewModel ViewModel => _vm;

    /// <summary>
    /// Hands the player its allowed page and locks the platform view down.
    ///
    /// The allowed page must be set before the source binding resolves, or the
    /// very first navigation — the lecture itself — is refused by its own
    /// policy. Hence the constructor rather than BeginLoad.
    ///
    /// The lockdown is where "no way out to YouTube" is actually enforced: the
    /// view cancels every navigation that is not this page and grants no new
    /// windows, so a changed YouTube layout cannot reopen a door. See
    /// SecurePlayerWebView for the layering.
    /// </summary>
    private void SecurePlayer()
    {
        Player.AllowedPage = new Uri(MauiProgram.ApiBaseAddress, "academic/player/");

        // A refused navigation is silent by design — nothing happens, which is
        // the point. Telling the student why keeps it from reading as a frozen
        // control.
        Player.NavigationBlocked += (_, _) => _vm.ReportBlockedNavigation();

        Player.FullscreenToggled += (_, on) => ApplyFullscreen(on);

#if WINDOWS
        Player.HandlerChanged += (_, _) =>
        {
            if (Player.Handler?.PlatformView is Microsoft.UI.Xaml.FrameworkElement native)
                Platforms.Windows.SecurePlayerWebViewSetup.Attach(Player, native);
        };
#endif
    }


    /// <summary>
    /// Expands the picture to fill the lecture screen, and back.
    ///
    /// Not the platform's fullscreen, deliberately. The window carries capture
    /// protection (SetWindowDisplayAffinity), and a genuinely fullscreen
    /// surface on another monitor or a detached window is exactly the kind of
    /// thing that slips outside that. Filling the app instead keeps the
    /// protected window the only place a lecture is ever drawn — and the
    /// watermark rides the frame, so it grows with it rather than being left
    /// behind at the old size.
    ///
    /// 920x518 is otherwise a maximum as well as a size; this is the one place
    /// the student may exceed it, and only inside the app.
    /// </summary>
    private void ApplyFullscreen(bool on)
    {
        // The picture keeps its 920 x 518 — the 11in 16:9 surface — in every
        // mode. It is a maximum as well as a size, and fullscreen is not an
        // exception to it: a lecture stretched past it is a lecture being
        // upscaled from the same source, softer rather than bigger.
        //
        // An earlier attempt cleared the two requests so the frame could fill.
        // It collapsed to a strip instead: this Border sits in a
        // VerticalStackLayout inside a ScrollView, which measures a child to
        // its content, and a WebView has no intrinsic height to measure. The
        // dimensions stay.
        //
        // What fullscreen actually removes is everything around the picture —
        // the notes, the title, the exercise, the unit rail, and (through
        // FullscreenChanged) the sidebar and top bar. The lecture is then the
        // only thing on screen, centred, which is what the control is for.
        BelowVideo.IsVisible = !on;
        RailColumn.Width = on ? new GridLength(0) : new GridLength(200);

        // Centred in what is left rather than pinned under a top bar that is
        // no longer there.
        PlayerColumn.VerticalOptions = on ? LayoutOptions.Center : LayoutOptions.Start;

        FullscreenChanged?.Invoke(this, on);
    }

    /// <summary>
    /// Raised when the player enters or leaves fullscreen, so the shell can put
    /// its own chrome away. The lecture screen cannot reach the sidebar or the
    /// top bar itself — they belong to the page hosting it.
    /// </summary>
    public event EventHandler<bool>? FullscreenChanged;

    public void BeginLoad()
    {
        _vm.Lesson.PropertyChanged += OnLessonChanged;
        _ = _vm.LoadAsync();

        StartWatermark();
    }

    /// <summary>Stops the timer. The host calls this when the view goes away.</summary>
    public void Teardown()
    {
        _vm.Lesson.PropertyChanged -= OnLessonChanged;

        if (_watermarkTimer is not null)
        {
            _watermarkTimer.Stop();
            _watermarkTimer.Tick -= OnWatermarkTick;
            _watermarkTimer = null;
        }
    }

    private void StartWatermark()
    {
        _vm.TickWatermark(DateTimeOffset.Now, movePosition: false);

        _watermarkTimer = Dispatcher.CreateTimer();
        _watermarkTimer.Interval = TimeSpan.FromSeconds(1);
        _watermarkTimer.Tick += OnWatermarkTick;
        _watermarkTimer.Start();
    }

    private void OnWatermarkTick(object? sender, EventArgs e)
    {
        _ticksSinceMove++;

        var move = _ticksSinceMove >= MoveEverySeconds;
        if (move) _ticksSinceMove = 0;

        _vm.TickWatermark(DateTimeOffset.Now, move);

        if (move) ApplyWatermarkPosition();
    }

    /// <summary>
    /// Moves the overlay between the frame's corners so it cannot be cropped
    /// out of a recording by trimming one edge.
    /// </summary>
    private void ApplyWatermarkPosition()
    {
        (Watermark.HorizontalOptions, Watermark.VerticalOptions) = _vm.WatermarkPosition switch
        {
            0 => (LayoutOptions.Start, LayoutOptions.Start),
            1 => (LayoutOptions.End, LayoutOptions.Start),
            2 => (LayoutOptions.End, LayoutOptions.End),
            _ => (LayoutOptions.Start, LayoutOptions.End),
        };
    }

    private void OnLessonChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName != nameof(_vm.Lesson.Status)) return;

        if (_vm.Lesson.HasData) BuildQuestions();
    }

    /// <summary>
    /// A styled resource by key, from wherever it is actually defined.
    ///
    /// This used to read Resources.MergedDictionaries.First(), which threw
    /// "sequence contains no elements" every time a lecture that HAS an
    /// exercise was opened: a view's own Resources collection is empty unless
    /// the XAML declares a ContentView.Resources block, and none of these
    /// screens do — every style lives in the application dictionary that
    /// App.xaml merges. Lectures without an exercise never reached the line,
    /// which is why it survived.
    ///
    /// Returns null rather than throwing if a key is ever renamed: an exercise
    /// rendered in the default font is a blemish, and taking the lecture screen
    /// down over it is not.
    /// </summary>
    private static T? Resource<T>(string key) where T : class =>
        Application.Current?.Resources.TryGetValue(key, out var value) == true ? value as T : null;

    /// <summary>
    /// Builds the exercise rows in code. The choice rows need per-choice
    /// selection state and a post-submit verdict colour, which is more legible
    /// here than in nested XAML templates reaching back up for two converters.
    /// </summary>
    private void BuildQuestions()
    {
        QuestionHost.Clear();

        if (_vm.Exercise is null) return;

        foreach (var question in _vm.Exercise.Questions.OrderBy(q => q.DisplayOrder))
        {
            var block = new VerticalStackLayout { Spacing = 8 };

            block.Add(new Label
            {
                Text = question.Text,
                Style = Resource<Style>("CopyLabel"),
            });

            var choices = new VerticalStackLayout { Spacing = 6 };

            foreach (var choice in question.Choices.OrderBy(c => c.DisplayOrder))
                choices.Add(BuildChoiceRow(question, choice));

            block.Add(choices);
            QuestionHost.Add(block);
        }
    }

    private View BuildChoiceRow(Question question, Choice choice)
    {
        var label = new Label
        {
            Text = choice.Text,
            FontSize = 13,
            VerticalOptions = LayoutOptions.Center,
        };

        var row = new Border
        {
            HeightRequest = 32,
            Padding = new Thickness(10, 0),
            StrokeThickness = 1,
            StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 6 },
            Content = label,
        };

        Paint(row, label, question, choice);

        row.GestureRecognizers.Add(new TapGestureRecognizer
        {
            Command = new Command(() =>
            {
                _vm.Choose(question.Id, choice.Id);
                BuildQuestions();
            }),
        });

        return row;
    }

    private void Paint(Border row, Label label, Question question, Choice choice)
    {
        var dark = Application.Current?.RequestedTheme == AppTheme.Dark;
        var selected = _vm.ChosenChoice(question.Id) == choice.Id;

        var border = Color.FromArgb(dark ? "#243044" : "#E2E8F0");
        var fill = Colors.Transparent;
        var ink = Color.FromArgb(dark ? "#E6EDF7" : "#0F172A");

        if (selected)
        {
            border = Color.FromArgb(dark ? "#4C8DFF" : "#1A56DB");
            fill = Color.FromArgb(dark ? "#244C8DFF" : "#141A56DB");
        }

        // After submitting, the correct row turns success and a wrong pick
        // turns danger — whatever the student had selected.
        switch (_vm.OutcomeFor(question, choice))
        {
            case ChoiceOutcome.Correct:
                border = Color.FromArgb(dark ? "#22C55E" : "#059669");
                fill = Color.FromArgb(dark ? "#2422C55E" : "#14059669");
                ink = border;
                break;

            case ChoiceOutcome.Wrong:
                border = Color.FromArgb(dark ? "#E74C3C" : "#C0392B");
                fill = Color.FromArgb(dark ? "#24E74C3C" : "#14C0392B");
                ink = border;
                break;
        }

        row.Stroke = border;
        row.BackgroundColor = fill;
        label.TextColor = ink;
    }

}
