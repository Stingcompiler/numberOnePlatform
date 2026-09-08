using NumberOne.Core.ViewModels;

namespace NumberOne.Desktop.Views;

public partial class AttemptDetailView : ContentView
{
    private readonly AttemptDetailViewModel _vm;

    public AttemptDetailView(AttemptDetailViewModel vm)
    {
        InitializeComponent();
        _vm = vm;
        BindingContext = vm;
    }

    public AttemptDetailViewModel ViewModel => _vm;

    public void BeginLoad() => _ = _vm.LoadAsync();
}
