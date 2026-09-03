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

        ForcePlayerLeftToRight();

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
    /// Pins the native web view to left-to-right, whatever the window is doing.
    ///
    /// The app window is RightToLeft, and WinUI mirrors a WebView2 that inherits
    /// that — it flips the rendered output, so the lecture plays back as a
    /// mirror image and any writing on the board reads backwards. On a maths
    /// lecture that is not cosmetic: the equations are unreadable.
    ///
    /// FlowDirection="LeftToRight" on the MAUI control is declared in the XAML
    /// and is the documented fix, but it is a MAUI-level property whose mapping
    /// to WebView2 has not held across handler versions. This reaches the
    /// platform element directly once its handler exists, so the setting cannot
    /// be lost in that translation. The page it loads also declares dir="ltr",
    /// which covers the document; this covers the control drawing it.
    /// </summary>
    private void ForcePlayerLeftToRight()
    {
#if WINDOWS
        Player.HandlerChanged += (_, _) =>
        {
            if (Player.Handler?.PlatformView is Microsoft.UI.Xaml.FrameworkElement native)
                native.FlowDirection = Microsoft.UI.Xaml.FlowDirection.LeftToRight;
        };
#endif
    }


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
                Style = (Style)Resources.MergedDictionaries.First()["CopyLabel"],
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
