
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# SmartThings Homebridge Plugin for JetBot

Simple plugin for interfacing with Samsung JetBot robot vacuums via SmartThings platform.

## Changelog

### 1.0.0: Initial release

## How to configure

You will need to create a SmartThings personal access token.  You can do that here: https://account.smartthings.com/tokens.  Create a
new token and make sure it has all of the device permissions.  Save your token and add it to the configuration.
<br>
This section should be added to the platforms array in your config.json file, but you can now edit using the config UI:
<pre>
        {
            "Name": "SmartThings Plugin",
            "AccessToken": "<INSERT YOUR PERSONAL ACCESS TOKEN HERE>",
            "BaseURL": "https://api.smartthings.com/v1",
            "platform": "HomeBridgeSmartThingsJetBot"
        }
</pre>
