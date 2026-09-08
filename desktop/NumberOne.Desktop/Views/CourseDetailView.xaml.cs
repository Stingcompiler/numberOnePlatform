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


    public void BeginLoad() => _ = _vm.LoadAsync();

}
