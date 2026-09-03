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

        // "انضم الآن" on the live banner opens the session outside the app, the
        // same way the live screen does. There is no embedded player anywhere.
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

    public HomeViewModel ViewModel => _vm;

    /// <summary>
    /// Starts every section loading. Deliberately not awaited by the caller:
    /// each section renders as it lands, and waiting here would reintroduce the
    /// "as slow as the slowest endpoint" behaviour the sections exist to avoid.
    /// </summary>
    public void BeginLoad() => _ = _vm.LoadAsync();
}
