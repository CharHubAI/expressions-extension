# Expressions Extension for Chub

This is a simple extension that classifies bot responses in order to 
show their expression pack images based on their current emotion.

It also serves as an example of how to develop an extension that 
can't be handled in the editor UI, or if you just prefer to use
a normal development environment.

Feel free to clone this project for use as a template. In particular, src/TestRunner.tsx
is a useful example of how to test things locally without a running chat.

You'll need node@21.7.1 and yarn installed.
Then, to get started:

``` 
git clone https://github.com/CharHubAI/expressions-extension
cd expressions-extension
yarn install
yarn dev
```

This project uses GitHub actions to update the extension in Chub on 
commits to the main branch. For your project to do this,
you'll need to get an extension auth token from [the api](https://api.chub.ai/openapi/swagger#/User%20Account/create_projects_token_account_tokens_projects_post).

Then in the GitHub project, go to Settings -> Secrets and Variables -> Actions ->
Repository secrets -> New Repository Secret. Add the token with the name "CHUB_AUTH_TOKEN".

You'll also need to add your extension's ID, which is the part after your username in the url,
e.g. "bartlebythescrivener-s-extension-edb5a90160e2". You can either add it directly to
the .github/workflows/deploy.yml or add another secret called "EXTENSION_ID".
