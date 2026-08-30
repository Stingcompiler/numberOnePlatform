using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

public partial class HomeView : ContentView
{
    private readonly HomeViewModel _vm;

    public HomeView(HomeViewModel vm)
    {
        InitializeComponent();

        _vm = vm;
        BindingContext = vm;
    }

    /// <summary>
    /// Starts every section loading. Deliberately not awaited by the caller:
    /// each section renders as it lands, and waiting here would reintroduce the
    /// "as slow as the slowest endpoint" behaviour the sections exist to avoid.
    /// </summary>
    public void BeginLoad() => _ = _vm.LoadAsync();
}
