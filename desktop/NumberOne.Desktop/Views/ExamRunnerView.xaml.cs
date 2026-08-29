using NumberOne.Core.Models;
using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

public partial class ExamRunnerView : ContentView
{
    private readonly ExamRunnerViewModel _vm;

    private IDispatcherTimer? _clock;

    public ExamRunnerView(ExamRunnerViewModel vm)
    {
        InitializeComponent();

        _vm = vm;
        BindingContext = vm;

        vm.PropertyChanged += OnViewModelChanged;
        vm.Warned += OnWarned;
        vm.RequestSubmitConfirmation += OnSubmitRequested;
    }

    public ExamRunnerViewModel ViewModel => _vm;

    public void BeginLoad()
    {
        _ = LoadThenStartClockAsync();
    }

    /// <summary>Stops the clock. The host calls this when the view goes away.</summary>
    public void Teardown()
    {
        _vm.PropertyChanged -= OnViewModelChanged;
        _vm.Warned -= OnWarned;
        _vm.RequestSubmitConfirmation -= OnSubmitRequested;

        if (_clock is not null)
        {
            _clock.Stop();
            _clock.Tick -= OnClockTick;
            _clock = null;
        }
    }

    private async Task LoadThenStartClockAsync()
    {
        await _vm.LoadAsync();

        BuildAnswers();

        // Started only after the exam has loaded, so the countdown does not run
        // against a duration that is still zero.
        _clock = Dispatcher.CreateTimer();
        _clock.Interval = TimeSpan.FromSeconds(1);
        _clock.Tick += OnClockTick;
        _clock.Start();
    }

    private async void OnClockTick(object? sender, EventArgs e)
        => await _vm.TickAsync(TimeSpan.FromSeconds(1));

    private void OnViewModelChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(ExamRunnerViewModel.QuestionIndex)
                           or nameof(ExamRunnerViewModel.Result))
        {
            BuildAnswers();
        }
    }

    private void OnWarned(object? sender, string message)
    {
        WarningLabel.Text = message;
        WarningLabel.IsVisible = true;

        // Auto-dismiss, matching the toast behaviour elsewhere.
        Dispatcher.DispatchDelayed(TimeSpan.FromSeconds(2.6), () => WarningLabel.IsVisible = false);
    }

    private async void OnSubmitRequested(object? sender, EventArgs e)
    {
        var page = this.Window?.Page;
        if (page is null) return;

        // Submitting is final; the design routes it through the shared confirm.
        var confirmed = await page.DisplayAlertAsync(
            "تسليم الاختبار",
            "لا يمكن تعديل الإجابات بعد التسليم. هل تريد المتابعة؟",
            "إنهاء وتسليم",
            "إلغاء");

        if (confirmed) await _vm.SubmitAsync();
    }

    /// <summary>
    /// Builds the answer control for the current question. Each exam question
    /// type takes a different answer shape, and the grader reads specific keys
    /// out of it — so the control and the payload are built together rather than
    /// left for a generic template to guess at.
    /// </summary>
    private void BuildAnswers()
    {
        AnswerHost.Clear();

        var question = _vm.CurrentQuestion;
        if (question is null || _vm.HasResult) return;

        switch (question.QuestionType)
        {
            case ExamAnswers.MultipleChoice:
                foreach (var option in question.Options.OrderBy(o => o.DisplayOrder))
                    AnswerHost.Add(Row(option.Text, _vm.ChosenOption(question.Id) == option.Id,
                        () => _vm.Answer(ExamAnswers.ForMultipleChoice(question.Id, option.Id))));
                break;

            case ExamAnswers.TrueFalse:
                AnswerHost.Add(Row("صواب", _vm.ChosenBoolean(question.Id) == true,
                    () => _vm.Answer(ExamAnswers.ForTrueFalse(question.Id, true))));
                AnswerHost.Add(Row("خطأ", _vm.ChosenBoolean(question.Id) == false,
                    () => _vm.Answer(ExamAnswers.ForTrueFalse(question.Id, false))));
                break;

            case ExamAnswers.FillBlank:
                var entry = new Entry
                {
                    FontSize = 13,
                    HeightRequest = 32,
                    Placeholder = "اكتب إجابتك",
                };
                entry.TextChanged += (_, args) =>
                    _vm.Answer(ExamAnswers.ForFillBlank(question.Id, args.NewTextValue ?? ""));
                AnswerHost.Add(entry);
                break;

            case ExamAnswers.Matching:
                // Matching needs a pairing control the design does not specify
                // for desktop. Rendered read-only rather than as a broken guess,
                // and flagged so it is not mistaken for finished.
                AnswerHost.Add(new Label
                {
                    Text = "أسئلة المطابقة غير مدعومة في هذه النسخة بعد.",
                    FontSize = 12,
                });
                break;
        }
    }

    private View Row(string text, bool selected, Action onTap)
    {
        var dark = Application.Current?.RequestedTheme == AppTheme.Dark;

        var label = new Label { Text = text, FontSize = 13, VerticalOptions = LayoutOptions.Center };

        var border = new Border
        {
            HeightRequest = 44,
            Padding = new Thickness(12, 0),
            StrokeThickness = 1,
            StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 6 },
            Stroke = selected
                ? Color.FromArgb(dark ? "#4C8DFF" : "#1A56DB")
                : Color.FromArgb(dark ? "#243044" : "#E2E8F0"),
            BackgroundColor = selected
                ? Color.FromArgb(dark ? "#244C8DFF" : "#141A56DB")
                : Colors.Transparent,
            Content = label,
        };

        border.GestureRecognizers.Add(new TapGestureRecognizer
        {
            Command = new Command(() => { onTap(); BuildAnswers(); }),
        });

        return border;
    }
}
