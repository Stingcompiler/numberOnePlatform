using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

public partial class CoursesView : ContentView
{
    private readonly CoursesViewModel _vm;

    public CoursesView(CoursesViewModel vm)
    {
        InitializeComponent();

        _vm = vm;
        BindingContext = vm;
    }

    public CoursesViewModel ViewModel => _vm;

    public void BeginLoad() => _ = _vm.LoadAsync();
}
