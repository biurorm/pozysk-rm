# Pozysk RM

PWA do codziennych telefonów do właścicieli z ogłoszeń (zbudowana 28.10.2026 z arkusza „1. Pozysk Klienta, Generał, Codziennie.xlsx”). Telefon i komputer.

- **📞 Dzwonię:** kogo dziś obdzwonić, grupy: Na dziś i zaległe, Nowe (jeszcze bez telefonu), Nie odebrali, Umówione spotkania, Do ponowienia bez terminu, Zaplanowane później. Filtr Moje / Cały zespół. Na karcie zielony przycisk z numerem (dzwoni od razu), niebieski link do ogłoszenia (otwiera portal), „Wynik”. Po kliknięciu numeru sama otwiera się karta wyniku rozmowy.
- **Wynik rozmowy:** STATUS, POWÓD, DALSZE DZIAŁANIA chipami, termin kolejnego telefonu (Jutro, Za 3 dni… albo data), notatka dopisuje się do UWAG z datą. Podpowiedzi: nieodebrany = ponowić jutro, zamknięty = zamknięcie kontaktu bez terminu. Każdy zapis idzie do historii telefonów.
- **＋ Nowy kontakt:** najpierw wklejasz link, aplikacja czyta z niego miasto, liczbę pokoi i sprzedaż/wynajem. Ostrzega, gdy ten numer albo ogłoszenie już były (z datą, agentem i statusem).
- **📋 Wszystkie:** cały arkusz z oryginalnymi tytułami kolumn, pogrupowany miesiącami; na komputerze tabela, na telefonie karty. Szukanie, filtry status/agent, „Pobierz do Excela (CSV)”.
- **📊 Wyniki:** telefony, rozmowy, spotkania, umowy w okresie, tabela „kto ile zrobił”, otwarte kontakty wg statusu, powody zamknięcia.
- **⚙️ Listy:** opcje każdej kolumny do klikania; AGENT z rolą agent / koordynatorka / menedżer. Wpis „✏️ Inne” w karcie dopisuje nową opcję sam. Menedżer ma tu import z Excela (powtórzony numer w arkuszu = kolejny wpis w historii, ponowny import nie robi dubli).

Dane w bazie Zadań RM (Supabase `zadania-rm`), to samo logowanie, tabele `pozysk` i `pozysk_listy` z `setup.sql`. Kontakt usuwa tylko menedżer. Numery telefonów klientów są tylko w bazie (RLS, logowanie), nigdy w repo. Tryb próbny: `index.html?proba`.
Nowa osoba (agent, koordynatorka): konto w Supabase > Authentication > Add user + profil w Zadaniach, a w Pozysku jej imię w Listy > AGENT (imię jak w profilu, wtedy działa filtr „Moje”).
Wydanie: podbij `WERSJA` w app.js, `?v=` w index.html i `CACHE` w sw.js, potem `bash publikuj.sh "opis"`.
