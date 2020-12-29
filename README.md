# PatchBoot

Bootstrapp your Secure Scuttlebutt Client.

## Functionality

PatchBoot allows executing (small) apps retrieved via ssb. These patchboot apps can access scuttlebut (sbot) as well as a DOM to interact with the user. These allows to enrich your scuttling experience with apps you get from your friends on Scuttlebutt.

## Getting started

PatchBoot is available in different flavours. Choose the PatchBoot flavour that best fits your needs.

### PatchBoot Electron

PatchBoot Electron provides a PatchBoot environment as a Desktop Application. This is the easiest option as it doesn't require configuration of the ssb-server or the browser.

on [git ssb](http://localhost:7718/%25kpL5iXptJ9tE4Otr%2FT292O1wXhILwyJ1uL9fEvuzu8o%3D.sha256) and [GitHub](https://github.com/retog/patchboot-electron)

### PatchBoot Web / ssb-patchnoot-ws

The [ssb server](https://github.com/ssbc/ssb-server) plugin `ssb-patchnoot-ws` gives access to PatchBoot via the browser.

on [git ssb](http://localhost:7718/%25i0elaPNUwbdizoEA0Vu882FgBpyopA1zJaf%2FyTImc9k%3D.sha256) and [GitHub](https://github.com/retog/ssb-patchboot-ws)|

## Publishing PatchBoot Apps

Apps are advertised using mesages of the type `patchboot-app` like the followig

```
{
    "type": "patchboot-app",
    "name": "WomBat Launcher",
    "comment": "A friendly new launcher",
    "link": "&CKrrSh72rXhgCzeTKekAPf7fiwtmNml/yFjXCe4ovnE=.sha256",
}
```

The link points to the JavaScript comprising the app. The JavaScript code has access to the following variables:

- `sbot`: an [rpc connection](https://ssbc.github.io/scuttlebutt-protocol-guide/#rpc-protocol) to an sbot
- `root`: the root of the shadow DOM
- `pull`: the [pull-stream](https://github.com/pull-stream/pull-stream) function object

### PatchBoot Install

The `patchboot-install` package provides an executable to deploy patchboot-apps. It is typically used in an npm-script as shown in the example app ([git ssb](http://localhost:7718/%25twbtHOe0su5W7DKukx8lI9YCqIhC6HoYbNstHLLjEe4%3D.sha256)|[GitHub](https://github.com/retog/patchboot-example-app)).

PathBoot Install is on [git ssb](http://localhost:7718/%25QiwZCEBr%2BVjz8iAJA1azXykvFHXCB%2FYINbDAoBtOw88%3D.sha256) and [GitHub](https://github.com/retog/patchboot-install)

