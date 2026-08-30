using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

public partial class CourseDetailView : ContentView
{
    private readonly CourseDetailViewModel _vm;

    public CourseDetailView(CourseDetailViewModel vm)
    {
        InitializeComponent();

        _vm = vm;
        BindingContext = vm;
    }

    public CourseDetailViewModel ViewModel => _vm;

    /// <summary>Raised by the back control; the shell restores the courses list.</summary>
    public event EventHandler? BackRequested;

    public void BeginLoad() => _ = _vm.LoadAsync();

    private void OnBackClicked(object? sender, EventArgs e) => BackRequested?.Invoke(this, EventArgs.Empty);
}
