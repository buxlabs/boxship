# deploy
Skrypty do wdrożeń

## Jak to działa?

Pakiet deploy jest udostępniony przez menadżer pakietów `npm` pod nazwą `@buxlabs/deploy`. Pakiet można zainstalować za pomocą komendy:

```bash
npm install @buxlabs/deploy --save-dev
```

Pakiet udostępnia skrypt o nazwie `deploy`, który jest dostępny do użycia w sekcji `scripts` pliku `package.json`, na przykład:

```bash
"deploy": "npm run build:production && deploy --username=someuser --host=s1.mydevil.net --domain=buxlabs.pl --location=~/domains/buxlabs.pl/public_nodejs --strategy=MyDevilNet --verbose"
```

Użycie skryptu deploy wymaga podania strategii danego wdrożenia `--stragegy`. Określa ona kroki jakie zostaną wykonane w celu wdrożenia nowej wersji aplikacji.

## Jakie są dostępne strategie?

### Static

Strategia dla statycznych hostingów udostępniających pliki z publicznego katalogu. Strategia ta polega na przekopiowaniu plików do wybranego folderu.

### MyDevilNet

Strategia dla hostingu MyDevilNet polega na usunięciu starych plików, przekopiowaniu nowych i zrestartowaniu serwera przy pomocy wbudowanej komendy oferowanej przez usługodawcę. Hosting wersji NodeJS opiera się na konwencji nazewnictwa plików i ich lokalizacji, co pozwala na obsługę aplikacji przy pomocy Passenger zainstalowanego przez usługodawcę.

W celu zalogowania się manualnie na serwer należy odpalić:

```
ssh -l <user> <numer_server>.mydevil.net
```
