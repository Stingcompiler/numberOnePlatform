using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

/// <summary>
/// Code-behind for the views that need nothing beyond a binding context and a
/// load trigger. Kept together rather than as five near-identical files.
/// </summary>
public partial class ExamsView : ContentView
{
    private readonly ExamsViewModel _vm;

    public ExamsView(ExamsViewModel vm)
    {
        InitializeComponent();
        _vm = vm;
        BindingContext = vm;
    }

    public ExamsViewModel ViewModel => _vm;

    public void BeginLoad() => _ = _vm.LoadAsync();
}

public partial class ResultsView : ContentView
{
    private readonly ResultsViewModel _vm;

    public ResultsView(ResultsViewModel vm)
    {
        InitializeComponent();
        _vm = vm;
        BindingContext = vm;
    }

    public ResultsViewModel ViewModel => _vm;

    public void BeginLoad() => _ = _vm.LoadAsync();
}

public partial class NotificationsView : ContentView
{
    private readonly NotificationsViewModel _vm;

    public NotificationsView(NotificationsViewModel vm)
    {
        InitializeComponent();
        _vm = vm;
        BindingContext = vm;
    }

    public NotificationsViewModel ViewModel => _vm;

    public void BeginLoad() => _ = _vm.LoadAsync();
}

public partial class ProfileView : ContentView
{
    public ProfileView(ProfileViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;

        vm.ClipboardWriter = text => Clipboard.Default.SetTextAsync(text);
    }
}

public partial class LiveView : ContentView
{
    private readonly LiveViewModel _vm;

    public LiveView(LiveViewModel vm)
    {
        InitializeComponent();
        _vm = vm;
        BindingContext = vm;

        // Opening in the system browser is the whole interaction: rooms hold
        // links to Zoom / Meet / Teams / YouTube and the app never embeds them.
        vm.BrowserLauncher = async url =>
        {
            try
            {
                await Launcher.Default.OpenAsync(url);
                return true;
            }
            catch (Exception)
            {
                // No browser, or the OS refused. The view model turns this into
                // "تعذّر فتح المتصفح على هذا الجهاز".
                return false;
            }
        };
    }

    public LiveViewModel ViewModel => _vm;

    public void BeginLoad() => _ = _vm.LoadAsync();
}
