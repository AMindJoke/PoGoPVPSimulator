using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace PokemonGoPvpSimulator
{
    public static class Program
    {
        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    public class MainForm : Form
    {
        private readonly GameData data;
        private readonly BattleLog log = new BattleLog();

        private ComboBox p1Pokemon;
        private ComboBox p1Fast;
        private ComboBox p1Charged1;
        private ComboBox p1Charged2;
        private ComboBox p2Pokemon;
        private ComboBox p2Fast;
        private ComboBox p2Charged1;
        private ComboBox p2Charged2;
        private NumericUpDown p1Shields;
        private NumericUpDown p2Shields;
        private Button startButton;
        private Button p1FastButton;
        private Button p1Charge1Button;
        private Button p1Charge2Button;
        private Button p2FastButton;
        private Button p2Charge1Button;
        private Button p2Charge2Button;
        private Button autoButton;
        private Button importButton;
        private ProgressBar p1HpBar;
        private ProgressBar p2HpBar;
        private Label p1Status;
        private Label p2Status;
        private TextBox logBox;

        private Combatant left;
        private Combatant right;

        public MainForm()
        {
            Text = "Pokemon GO PvP Simulator";
            Width = 1060;
            Height = 720;
            MinimumSize = new Size(980, 640);
            Font = new Font("Segoe UI", 9F);
            BackColor = Color.FromArgb(245, 247, 250);

            data = GameData.Load();
            BuildUi();
            BindPokemon();
        }

        private void BuildUi()
        {
            var root = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4, Padding = new Padding(12) };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 178));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 168));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            Controls.Add(root);

            var header = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.LeftToRight };
            startButton = Button("Avvia lotta");
            autoButton = Button("Auto 20 turni");
            importButton = Button("Importa gamemaster PvPoke");
            startButton.Click += delegate { StartBattle(); };
            autoButton.Click += delegate { AutoPlay(20); };
            importButton.Click += delegate { ImportGameMaster(); };
            header.Controls.Add(startButton);
            header.Controls.Add(autoButton);
            header.Controls.Add(importButton);
            var source = new Label
            {
                Text = data.SourceNote,
                AutoSize = true,
                ForeColor = Color.FromArgb(73, 85, 102),
                Padding = new Padding(14, 8, 0, 0)
            };
            header.Controls.Add(source);
            root.Controls.Add(header, 0, 0);

            var setup = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1 };
            setup.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            setup.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            root.Controls.Add(setup, 0, 1);

            p1Pokemon = Combo();
            p1Fast = Combo();
            p1Charged1 = Combo();
            p1Charged2 = Combo();
            p1Shields = ShieldsBox();
            p2Pokemon = Combo();
            p2Fast = Combo();
            p2Charged1 = Combo();
            p2Charged2 = Combo();
            p2Shields = ShieldsBox();

            setup.Controls.Add(SetupPanel("Allenatore A", p1Pokemon, p1Fast, p1Charged1, p1Charged2, p1Shields), 0, 0);
            setup.Controls.Add(SetupPanel("Allenatore B", p2Pokemon, p2Fast, p2Charged1, p2Charged2, p2Shields), 1, 0);

            var battlefield = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1 };
            battlefield.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            battlefield.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            root.Controls.Add(battlefield, 0, 2);

            p1HpBar = HpBar();
            p2HpBar = HpBar();
            p1Status = StatusLabel();
            p2Status = StatusLabel();
            p1FastButton = Button("Veloce");
            p1Charge1Button = Button("Caricata 1");
            p1Charge2Button = Button("Caricata 2");
            p2FastButton = Button("Veloce");
            p2Charge1Button = Button("Caricata 1");
            p2Charge2Button = Button("Caricata 2");
            p1FastButton.Click += delegate { UseFast(left, right); };
            p1Charge1Button.Click += delegate { UseCharge(left, right, 0); };
            p1Charge2Button.Click += delegate { UseCharge(left, right, 1); };
            p2FastButton.Click += delegate { UseFast(right, left); };
            p2Charge1Button.Click += delegate { UseCharge(right, left, 0); };
            p2Charge2Button.Click += delegate { UseCharge(right, left, 1); };

            battlefield.Controls.Add(BattlePanel("A", p1HpBar, p1Status, p1FastButton, p1Charge1Button, p1Charge2Button), 0, 0);
            battlefield.Controls.Add(BattlePanel("B", p2HpBar, p2Status, p2FastButton, p2Charge1Button, p2Charge2Button), 1, 0);

            logBox = new TextBox
            {
                Dock = DockStyle.Fill,
                Multiline = true,
                ScrollBars = ScrollBars.Vertical,
                ReadOnly = true,
                BackColor = Color.White,
                Font = new Font("Consolas", 9F)
            };
            root.Controls.Add(logBox, 0, 3);
        }

        private Control SetupPanel(string title, ComboBox pokemon, ComboBox fast, ComboBox charge1, ComboBox charge2, NumericUpDown shields)
        {
            var box = Panel();
            var grid = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 6, Padding = new Padding(10) };
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 95));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            box.Controls.Add(grid);
            grid.Controls.Add(Title(title), 0, 0);
            grid.SetColumnSpan(grid.Controls[0], 2);
            AddRow(grid, 1, "Pokemon", pokemon);
            AddRow(grid, 2, "Veloce", fast);
            AddRow(grid, 3, "Caricata 1", charge1);
            AddRow(grid, 4, "Caricata 2", charge2);
            AddRow(grid, 5, "Scudi", shields);
            pokemon.SelectedIndexChanged += delegate { PopulateMoves(pokemon, fast, charge1, charge2); };
            return box;
        }

        private Control BattlePanel(string title, ProgressBar hp, Label status, Button fast, Button charge1, Button charge2)
        {
            var box = Panel();
            var grid = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4, Padding = new Padding(10) };
            grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
            grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 28));
            grid.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
            box.Controls.Add(grid);
            grid.Controls.Add(Title("Allenatore " + title), 0, 0);
            grid.Controls.Add(hp, 0, 1);
            grid.Controls.Add(status, 0, 2);
            var actions = new FlowLayoutPanel { Dock = DockStyle.Fill };
            actions.Controls.Add(fast);
            actions.Controls.Add(charge1);
            actions.Controls.Add(charge2);
            grid.Controls.Add(actions, 0, 3);
            return box;
        }

        private static Panel Panel()
        {
            return new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Margin = new Padding(6), BorderStyle = BorderStyle.FixedSingle };
        }

        private static Label Title(string text)
        {
            return new Label { Text = text, AutoSize = true, Font = new Font("Segoe UI Semibold", 10F), ForeColor = Color.FromArgb(23, 32, 42) };
        }

        private static Label Label(string text)
        {
            return new Label { Text = text, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft, ForeColor = Color.FromArgb(63, 74, 89) };
        }

        private static void AddRow(TableLayoutPanel grid, int row, string label, Control input)
        {
            grid.RowStyles.Add(new RowStyle(SizeType.Absolute, 28));
            grid.Controls.Add(Label(label), 0, row);
            grid.Controls.Add(input, 1, row);
        }

        private static ComboBox Combo()
        {
            return new ComboBox { Dock = DockStyle.Fill, DropDownStyle = ComboBoxStyle.DropDownList };
        }

        private static NumericUpDown ShieldsBox()
        {
            return new NumericUpDown { Dock = DockStyle.Left, Minimum = 0, Maximum = 2, Value = 2, Width = 64 };
        }

        private static Button Button(string text)
        {
            return new Button { Text = text, AutoSize = true, Height = 30, Margin = new Padding(4) };
        }

        private static ProgressBar HpBar()
        {
            return new ProgressBar { Dock = DockStyle.Fill, Minimum = 0, Maximum = 100, Value = 100 };
        }

        private static Label StatusLabel()
        {
            return new Label { Dock = DockStyle.Fill, AutoSize = false, ForeColor = Color.FromArgb(37, 48, 62) };
        }

        private void BindPokemon()
        {
            var names = data.Pokemon.Values.OrderBy(p => p.Name).Select(p => p.Name).ToArray();
            p1Pokemon.Items.AddRange(names);
            p2Pokemon.Items.AddRange(names);
            if (p1Pokemon.Items.Count > 0) p1Pokemon.SelectedIndex = Math.Min(0, p1Pokemon.Items.Count - 1);
            if (p2Pokemon.Items.Count > 1) p2Pokemon.SelectedIndex = Math.Min(1, p2Pokemon.Items.Count - 1);
        }

        private void PopulateMoves(ComboBox pokemonCombo, ComboBox fastCombo, ComboBox c1, ComboBox c2)
        {
            var pokemon = data.FindPokemon(Convert.ToString(pokemonCombo.SelectedItem));
            if (pokemon == null) return;
            fastCombo.Items.Clear();
            c1.Items.Clear();
            c2.Items.Clear();
            fastCombo.Items.AddRange(pokemon.FastMoves.Where(id => data.Moves.ContainsKey(id)).Select(id => data.Moves[id].Name).ToArray());
            c1.Items.AddRange(pokemon.ChargedMoves.Where(id => data.Moves.ContainsKey(id)).Select(id => data.Moves[id].Name).ToArray());
            c2.Items.AddRange(pokemon.ChargedMoves.Where(id => data.Moves.ContainsKey(id)).Select(id => data.Moves[id].Name).ToArray());
            if (fastCombo.Items.Count > 0) fastCombo.SelectedIndex = 0;
            if (c1.Items.Count > 0) c1.SelectedIndex = 0;
            if (c2.Items.Count > 1) c2.SelectedIndex = 1;
            else if (c2.Items.Count > 0) c2.SelectedIndex = 0;
        }

        private void StartBattle()
        {
            left = CreateCombatant("A", p1Pokemon, p1Fast, p1Charged1, p1Charged2, p1Shields);
            right = CreateCombatant("B", p2Pokemon, p2Fast, p2Charged1, p2Charged2, p2Shields);
            log.Clear();
            log.Add("Lotta avviata: {0} contro {1}", left.Pokemon.Name, right.Pokemon.Name);
            UpdateBattleUi();
        }

        private Combatant CreateCombatant(string trainer, ComboBox poke, ComboBox fast, ComboBox c1, ComboBox c2, NumericUpDown shields)
        {
            var pokemon = data.FindPokemon(Convert.ToString(poke.SelectedItem));
            if (pokemon == null) throw new InvalidOperationException("Pokemon non trovato.");
            var moves = new List<Move>();
            moves.Add(data.FindMove(Convert.ToString(fast.SelectedItem)));
            moves.Add(data.FindMove(Convert.ToString(c1.SelectedItem)));
            moves.Add(data.FindMove(Convert.ToString(c2.SelectedItem)));
            return new Combatant(trainer, pokemon, moves[0], new[] { moves[1], moves[2] }, Decimal.ToInt32(shields.Value));
        }

        private void UseFast(Combatant attacker, Combatant defender)
        {
            if (!Ready(attacker, defender)) return;
            var result = BattleMath.ApplyMove(attacker, defender, attacker.FastMove, false);
            log.Add("{0}: {1} usa {2}: {3} danni, +{4} energia.", attacker.Trainer, attacker.Pokemon.Name, attacker.FastMove.Name, result.Damage, attacker.FastMove.EnergyGain);
            FinishAction();
        }

        private void UseCharge(Combatant attacker, Combatant defender, int index)
        {
            if (!Ready(attacker, defender)) return;
            var move = attacker.ChargedMoves[index];
            if (attacker.Energy < move.EnergyCost)
            {
                log.Add("{0}: energia insufficiente per {1} ({2}/{3}).", attacker.Trainer, move.Name, attacker.Energy, move.EnergyCost);
                UpdateBattleUi();
                return;
            }
            var shielded = defender.Shields > 0;
            var result = BattleMath.ApplyMove(attacker, defender, move, shielded);
            if (shielded)
            {
                defender.Shields--;
                log.Add("{0}: {1} usa {2}; {3} usa uno scudo. Danni ridotti a {4}.", attacker.Trainer, attacker.Pokemon.Name, move.Name, defender.Trainer, result.Damage);
            }
            else
            {
                log.Add("{0}: {1} usa {2}: {3} danni.", attacker.Trainer, attacker.Pokemon.Name, move.Name, result.Damage);
            }
            FinishAction();
        }

        private bool Ready(Combatant a, Combatant b)
        {
            if (a == null || b == null)
            {
                StartBattle();
                return left != null && right != null;
            }
            if (left.IsFainted || right.IsFainted)
            {
                log.Add("La lotta e' finita. Premi Avvia lotta per ricominciare.");
                UpdateBattleUi();
                return false;
            }
            return true;
        }

        private void AutoPlay(int turns)
        {
            if (left == null || right == null) StartBattle();
            for (var i = 0; i < turns && !left.IsFainted && !right.IsFainted; i++)
            {
                AutoAction(left, right);
                if (!right.IsFainted) AutoAction(right, left);
            }
            FinishAction();
        }

        private void AutoAction(Combatant attacker, Combatant defender)
        {
            var charged = attacker.ChargedMoves.Where(m => attacker.Energy >= m.EnergyCost).OrderByDescending(m => BattleMath.EstimateDamage(attacker, defender, m)).FirstOrDefault();
            if (charged != null) UseCharge(attacker, defender, Array.IndexOf(attacker.ChargedMoves, charged));
            else UseFast(attacker, defender);
        }

        private void FinishAction()
        {
            if (left != null && right != null)
            {
                if (left.IsFainted && right.IsFainted) log.Add("Pareggio.");
                else if (left.IsFainted) log.Add("Vince Allenatore B.");
                else if (right.IsFainted) log.Add("Vince Allenatore A.");
            }
            UpdateBattleUi();
        }

        private void UpdateBattleUi()
        {
            UpdateSide(left, p1HpBar, p1Status, p1Charge1Button, p1Charge2Button);
            UpdateSide(right, p2HpBar, p2Status, p2Charge1Button, p2Charge2Button);
            logBox.Text = log.ToString();
            logBox.SelectionStart = logBox.TextLength;
            logBox.ScrollToCaret();
        }

        private static void UpdateSide(Combatant c, ProgressBar bar, Label status, Button c1, Button c2)
        {
            if (c == null)
            {
                bar.Value = 100;
                status.Text = "";
                return;
            }
            var percent = Math.Max(0, Math.Min(100, (int)Math.Round(100.0 * c.Hp / c.MaxHp)));
            bar.Value = percent;
            status.Text = string.Format("{0}\r\nHP {1}/{2} | Energia {3}/100 | Scudi {4}\r\nTipi: {5}",
                c.Pokemon.Name, Math.Max(0, c.Hp), c.MaxHp, c.Energy, c.Shields, string.Join("/", c.Pokemon.Types));
            c1.Text = string.Format("{0} ({1})", c.ChargedMoves[0].Name, c.ChargedMoves[0].EnergyCost);
            c2.Text = string.Format("{0} ({1})", c.ChargedMoves[1].Name, c.ChargedMoves[1].EnergyCost);
        }

        private void ImportGameMaster()
        {
            using (var dialog = new OpenFileDialog())
            {
                dialog.Title = "Seleziona gamemaster.json di PvPoke";
                dialog.Filter = "JSON (*.json)|*.json|Tutti i file (*.*)|*.*";
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                try
                {
                    var imported = GameData.FromPvpoke(File.ReadAllText(dialog.FileName, Encoding.UTF8), "PvPoke importato: " + Path.GetFileName(dialog.FileName));
                    imported.SaveLocal();
                    MessageBox.Show(this, "Dati importati. Riapri il programma per usare il dataset completo.", "Importazione completata", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show(this, "Non sono riuscito a importare il file: " + ex.Message, "Importazione non riuscita", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
        }
    }

    public class Combatant
    {
        public string Trainer;
        public Pokemon Pokemon;
        public Move FastMove;
        public Move[] ChargedMoves;
        public int MaxHp;
        public int Hp;
        public int Energy;
        public int Shields;
        public double Attack;
        public double Defense;

        public Combatant(string trainer, Pokemon pokemon, Move fastMove, Move[] chargedMoves, int shields)
        {
            Trainer = trainer;
            Pokemon = pokemon;
            FastMove = fastMove;
            ChargedMoves = chargedMoves;
            Shields = shields;
            Attack = Math.Max(80, pokemon.Atk * 0.78);
            Defense = Math.Max(80, pokemon.Def * 0.78);
            MaxHp = Math.Max(90, (int)Math.Round(pokemon.Hp * 0.78));
            Hp = MaxHp;
        }

        public bool IsFainted { get { return Hp <= 0; } }
    }

    public class BattleResult
    {
        public int Damage;
    }

    public static class BattleMath
    {
        private static readonly Dictionary<string, string[]> Strong = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            {"Bug", new[]{"Dark","Grass","Psychic"}},
            {"Dark", new[]{"Ghost","Psychic"}},
            {"Dragon", new[]{"Dragon"}},
            {"Electric", new[]{"Flying","Water"}},
            {"Fairy", new[]{"Dark","Dragon","Fighting"}},
            {"Fighting", new[]{"Dark","Ice","Normal","Rock","Steel"}},
            {"Fire", new[]{"Bug","Grass","Ice","Steel"}},
            {"Flying", new[]{"Bug","Fighting","Grass"}},
            {"Ghost", new[]{"Ghost","Psychic"}},
            {"Grass", new[]{"Ground","Rock","Water"}},
            {"Ground", new[]{"Electric","Fire","Poison","Rock","Steel"}},
            {"Ice", new[]{"Dragon","Flying","Grass","Ground"}},
            {"Poison", new[]{"Fairy","Grass"}},
            {"Psychic", new[]{"Fighting","Poison"}},
            {"Rock", new[]{"Bug","Fire","Flying","Ice"}},
            {"Steel", new[]{"Fairy","Ice","Rock"}},
            {"Water", new[]{"Fire","Ground","Rock"}}
        };

        private static readonly Dictionary<string, string[]> Weak = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            {"Bug", new[]{"Fairy","Fighting","Fire","Flying","Ghost","Poison","Steel"}},
            {"Dark", new[]{"Dark","Fairy","Fighting"}},
            {"Dragon", new[]{"Steel"}},
            {"Electric", new[]{"Dragon","Electric","Grass","Ground"}},
            {"Fairy", new[]{"Fire","Poison","Steel"}},
            {"Fighting", new[]{"Bug","Fairy","Flying","Ghost","Poison","Psychic"}},
            {"Fire", new[]{"Dragon","Fire","Rock","Water"}},
            {"Flying", new[]{"Electric","Rock","Steel"}},
            {"Ghost", new[]{"Dark","Normal"}},
            {"Grass", new[]{"Bug","Dragon","Fire","Flying","Grass","Poison","Steel"}},
            {"Ground", new[]{"Bug","Flying","Grass"}},
            {"Ice", new[]{"Fire","Ice","Steel","Water"}},
            {"Normal", new[]{"Ghost","Rock","Steel"}},
            {"Poison", new[]{"Ghost","Ground","Poison","Rock","Steel"}},
            {"Psychic", new[]{"Dark","Psychic","Steel"}},
            {"Rock", new[]{"Fighting","Ground","Steel"}},
            {"Steel", new[]{"Electric","Fire","Steel","Water"}},
            {"Water", new[]{"Dragon","Grass","Water"}}
        };

        public static BattleResult ApplyMove(Combatant attacker, Combatant defender, Move move, bool shielded)
        {
            var damage = EstimateDamage(attacker, defender, move);
            if (shielded) damage = Math.Max(1, (int)Math.Round(damage * 0.25));
            defender.Hp -= damage;
            attacker.Energy = Math.Max(0, Math.Min(100, attacker.Energy + move.EnergyGain - move.EnergyCost));
            return new BattleResult { Damage = damage };
        }

        public static int EstimateDamage(Combatant attacker, Combatant defender, Move move)
        {
            var stab = attacker.Pokemon.Types.Any(t => Same(t, move.Type)) ? 1.2 : 1.0;
            var effectiveness = Effectiveness(move.Type, defender.Pokemon.Types);
            var raw = Math.Floor(0.5 * move.Power * attacker.Attack / defender.Defense * stab * effectiveness) + 1;
            return Math.Max(1, (int)raw);
        }

        private static double Effectiveness(string moveType, IEnumerable<string> defenderTypes)
        {
            double total = 1.0;
            foreach (var type in defenderTypes)
            {
                if (Strong.ContainsKey(moveType) && Strong[moveType].Any(t => Same(t, type))) total *= 1.6;
                if (Weak.ContainsKey(moveType) && Weak[moveType].Any(t => Same(t, type))) total *= 0.625;
            }
            return total;
        }

        private static bool Same(string a, string b)
        {
            return string.Equals(a, b, StringComparison.OrdinalIgnoreCase);
        }
    }

    public class Pokemon
    {
        public string Id;
        public string Name;
        public string[] Types;
        public int Atk;
        public int Def;
        public int Hp;
        public List<string> FastMoves = new List<string>();
        public List<string> ChargedMoves = new List<string>();
    }

    public class Move
    {
        public string Id;
        public string Name;
        public string Type;
        public int Power;
        public int EnergyGain;
        public int EnergyCost;
        public bool IsFast { get { return EnergyGain > 0; } }
    }

    public class GameData
    {
        public Dictionary<string, Pokemon> Pokemon = new Dictionary<string, Pokemon>(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, Move> Moves = new Dictionary<string, Move>(StringComparer.OrdinalIgnoreCase);
        public string SourceNote = "Dataset iniziale incluso. Puoi importare gamemaster.json da PvPoke.";

        public static GameData Load()
        {
            var local = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "pvp_data.json");
            if (File.Exists(local))
            {
                try { return FromAppJson(File.ReadAllText(local, Encoding.UTF8), "Dataset locale: pvp_data.json"); }
                catch { }
            }
            return FromAppJson(Seed.Json, "Dataset iniziale incluso. Fonte numeri mosse: PvPoke/Pokemon GO PvP.");
        }

        public void SaveLocal()
        {
            File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "pvp_data.json"), ToAppJson(), Encoding.UTF8);
        }

        public Pokemon FindPokemon(string name)
        {
            return Pokemon.Values.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
        }

        public Move FindMove(string name)
        {
            return Moves.Values.FirstOrDefault(m => string.Equals(m.Name, name, StringComparison.OrdinalIgnoreCase));
        }

        public static GameData FromAppJson(string json, string sourceNote)
        {
            var serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            var root = serializer.Deserialize<Dictionary<string, object>>(json);
            var data = new GameData { SourceNote = sourceNote };
            foreach (Dictionary<string, object> m in ListOfObjects(root, "moves"))
            {
                var move = new Move
                {
                    Id = S(m, "id"),
                    Name = S(m, "name"),
                    Type = S(m, "type"),
                    Power = I(m, "power"),
                    EnergyGain = I(m, "energyGain"),
                    EnergyCost = I(m, "energyCost")
                };
                data.Moves[move.Id] = move;
            }
            foreach (Dictionary<string, object> p in ListOfObjects(root, "pokemon"))
            {
                var pokemon = new Pokemon
                {
                    Id = S(p, "id"),
                    Name = S(p, "name"),
                    Types = Arr(p, "types"),
                    Atk = I(p, "atk"),
                    Def = I(p, "def"),
                    Hp = I(p, "hp"),
                    FastMoves = Arr(p, "fastMoves").ToList(),
                    ChargedMoves = Arr(p, "chargedMoves").ToList()
                };
                data.Pokemon[pokemon.Id] = pokemon;
            }
            return data;
        }

        public static GameData FromPvpoke(string json, string sourceNote)
        {
            var serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            var root = serializer.Deserialize<Dictionary<string, object>>(json);
            var data = new GameData { SourceNote = sourceNote };
            foreach (Dictionary<string, object> m in ListOfObjects(root, "moves"))
            {
                var move = new Move
                {
                    Id = S(m, "moveId"),
                    Name = S(m, "name"),
                    Type = TitleCase(S(m, "type")),
                    Power = I(m, "power"),
                    EnergyGain = I(m, "energyGain"),
                    EnergyCost = Math.Abs(I(m, "energy"))
                };
                if (string.IsNullOrEmpty(move.Id)) move.Id = move.Name.Replace(" ", "_").ToUpperInvariant();
                if (move.Power > 0) data.Moves[move.Id] = move;
            }
            foreach (Dictionary<string, object> p in ListOfObjects(root, "pokemon"))
            {
                if (!p.ContainsKey("baseStats")) continue;
                var baseStats = (Dictionary<string, object>)p["baseStats"];
                var pokemon = new Pokemon
                {
                    Id = S(p, "speciesId"),
                    Name = S(p, "speciesName"),
                    Types = Arr(p, "types").Select(TitleCase).ToArray(),
                    Atk = I(baseStats, "atk"),
                    Def = I(baseStats, "def"),
                    Hp = I(baseStats, "hp"),
                    FastMoves = Arr(p, "fastMoves").Where(id => data.Moves.ContainsKey(id)).ToList(),
                    ChargedMoves = Arr(p, "chargedMoves").Where(id => data.Moves.ContainsKey(id)).ToList()
                };
                if (pokemon.FastMoves.Count > 0 && pokemon.ChargedMoves.Count > 0) data.Pokemon[pokemon.Id] = pokemon;
            }
            return data;
        }

        private string ToAppJson()
        {
            var serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            var root = new Dictionary<string, object>();
            root["moves"] = Moves.Values.Select(m => new Dictionary<string, object>
            {
                {"id", m.Id}, {"name", m.Name}, {"type", m.Type}, {"power", m.Power}, {"energyGain", m.EnergyGain}, {"energyCost", m.EnergyCost}
            }).ToArray();
            root["pokemon"] = Pokemon.Values.Select(p => new Dictionary<string, object>
            {
                {"id", p.Id}, {"name", p.Name}, {"types", p.Types}, {"atk", p.Atk}, {"def", p.Def}, {"hp", p.Hp},
                {"fastMoves", p.FastMoves.ToArray()}, {"chargedMoves", p.ChargedMoves.ToArray()}
            }).ToArray();
            return serializer.Serialize(root);
        }

        private static string S(Dictionary<string, object> d, string key)
        {
            return d.ContainsKey(key) && d[key] != null ? Convert.ToString(d[key]) : "";
        }

        private static int I(Dictionary<string, object> d, string key)
        {
            if (!d.ContainsKey(key) || d[key] == null) return 0;
            return Convert.ToInt32(Math.Round(Convert.ToDouble(d[key])));
        }

        private static string[] Arr(Dictionary<string, object> d, string key)
        {
            if (!d.ContainsKey(key) || d[key] == null) return new string[0];
            var values = d[key] as IEnumerable;
            if (values == null || d[key] is string) return new string[0];
            return values.Cast<object>().Select(Convert.ToString).ToArray();
        }

        private static IEnumerable<Dictionary<string, object>> ListOfObjects(Dictionary<string, object> d, string key)
        {
            if (!d.ContainsKey(key) || d[key] == null) yield break;
            var values = d[key] as IEnumerable;
            if (values == null || d[key] is string) yield break;
            foreach (var item in values)
            {
                var typed = item as Dictionary<string, object>;
                if (typed != null) yield return typed;
            }
        }

        private static string TitleCase(string s)
        {
            if (string.IsNullOrEmpty(s)) return s;
            s = s.ToLowerInvariant();
            return char.ToUpperInvariant(s[0]) + s.Substring(1);
        }
    }

    public class BattleLog
    {
        private readonly List<string> lines = new List<string>();
        public void Clear() { lines.Clear(); }
        public void Add(string format, params object[] args)
        {
            lines.Add(string.Format("[{0:HH:mm:ss}] {1}", DateTime.Now, string.Format(format, args)));
        }
        public override string ToString()
        {
            return string.Join(Environment.NewLine, lines.ToArray());
        }
    }

    public static class Seed
    {
        public const string Json = @"{
  ""moves"": [
    {""id"":""COUNTER"",""name"":""Counter"",""type"":""Fighting"",""power"":8,""energyGain"":7,""energyCost"":0},
    {""id"":""MUD_SHOT"",""name"":""Mud Shot"",""type"":""Ground"",""power"":3,""energyGain"":9,""energyCost"":0},
    {""id"":""DRAGON_BREATH"",""name"":""Dragon Breath"",""type"":""Dragon"",""power"":4,""energyGain"":3,""energyCost"":0},
    {""id"":""SHADOW_CLAW"",""name"":""Shadow Claw"",""type"":""Ghost"",""power"":6,""energyGain"":8,""energyCost"":0},
    {""id"":""SNARL"",""name"":""Snarl"",""type"":""Dark"",""power"":5,""energyGain"":13,""energyCost"":0},
    {""id"":""INCINERATE"",""name"":""Incinerate"",""type"":""Fire"",""power"":20,""energyGain"":20,""energyCost"":0},
    {""id"":""POISON_STING"",""name"":""Poison Sting"",""type"":""Poison"",""power"":3,""energyGain"":9,""energyCost"":0},
    {""id"":""VOLT_SWITCH"",""name"":""Volt Switch"",""type"":""Electric"",""power"":12,""energyGain"":16,""energyCost"":0},
    {""id"":""WING_ATTACK"",""name"":""Wing Attack"",""type"":""Flying"",""power"":5,""energyGain"":8,""energyCost"":0},
    {""id"":""BULLET_SEED"",""name"":""Bullet Seed"",""type"":""Grass"",""power"":5,""energyGain"":13,""energyCost"":0},
    {""id"":""BUBBLE"",""name"":""Bubble"",""type"":""Water"",""power"":8,""energyGain"":11,""energyCost"":0},
    {""id"":""HYDRO_CANNON"",""name"":""Hydro Cannon"",""type"":""Water"",""power"":80,""energyGain"":0,""energyCost"":40},
    {""id"":""EARTHQUAKE"",""name"":""Earthquake"",""type"":""Ground"",""power"":110,""energyGain"":0,""energyCost"":65},
    {""id"":""ROCK_SLIDE"",""name"":""Rock Slide"",""type"":""Rock"",""power"":75,""energyGain"":0,""energyCost"":45},
    {""id"":""SKY_ATTACK"",""name"":""Sky Attack"",""type"":""Flying"",""power"":75,""energyGain"":0,""energyCost"":45},
    {""id"":""BRAVE_BIRD"",""name"":""Brave Bird"",""type"":""Flying"",""power"":130,""energyGain"":0,""energyCost"":55},
    {""id"":""BODY_SLAM"",""name"":""Body Slam"",""type"":""Normal"",""power"":60,""energyGain"":0,""energyCost"":35},
    {""id"":""SHADOW_BALL"",""name"":""Shadow Ball"",""type"":""Ghost"",""power"":100,""energyGain"":0,""energyCost"":55},
    {""id"":""ICE_BEAM"",""name"":""Ice Beam"",""type"":""Ice"",""power"":90,""energyGain"":0,""energyCost"":55},
    {""id"":""PLAY_ROUGH"",""name"":""Play Rough"",""type"":""Fairy"",""power"":90,""energyGain"":0,""energyCost"":60},
    {""id"":""PSYCHIC"",""name"":""Psychic"",""type"":""Psychic"",""power"":85,""energyGain"":0,""energyCost"":55},
    {""id"":""FOCUS_BLAST"",""name"":""Focus Blast"",""type"":""Fighting"",""power"":150,""energyGain"":0,""energyCost"":75},
    {""id"":""ZAP_CANNON"",""name"":""Zap Cannon"",""type"":""Electric"",""power"":150,""energyGain"":0,""energyCost"":80},
    {""id"":""FOUL_PLAY"",""name"":""Foul Play"",""type"":""Dark"",""power"":70,""energyGain"":0,""energyCost"":45},
    {""id"":""NIGHT_SLASH"",""name"":""Night Slash"",""type"":""Dark"",""power"":50,""energyGain"":0,""energyCost"":35},
    {""id"":""DRILL_RUN"",""name"":""Drill Run"",""type"":""Ground"",""power"":85,""energyGain"":0,""energyCost"":45},
    {""id"":""WILD_CHARGE"",""name"":""Wild Charge"",""type"":""Electric"",""power"":100,""energyGain"":0,""energyCost"":45},
    {""id"":""WEATHER_BALL_FIRE"",""name"":""Weather Ball Fire"",""type"":""Fire"",""power"":55,""energyGain"":0,""energyCost"":35},
    {""id"":""SEED_BOMB"",""name"":""Seed Bomb"",""type"":""Grass"",""power"":60,""energyGain"":0,""energyCost"":45}
  ],
  ""pokemon"": [
    {""id"":""swampert"",""name"":""Swampert"",""types"":[""Water"",""Ground""],""atk"":208,""def"":175,""hp"":225,""fastMoves"":[""MUD_SHOT""],""chargedMoves"":[""HYDRO_CANNON"",""EARTHQUAKE""]},
    {""id"":""medicham"",""name"":""Medicham"",""types"":[""Fighting"",""Psychic""],""atk"":121,""def"":152,""hp"":155,""fastMoves"":[""COUNTER""],""chargedMoves"":[""ICE_BEAM"",""PSYCHIC""]},
    {""id"":""skarmory"",""name"":""Skarmory"",""types"":[""Steel"",""Flying""],""atk"":148,""def"":226,""hp"":163,""fastMoves"":[""WING_ATTACK""],""chargedMoves"":[""SKY_ATTACK"",""BRAVE_BIRD""]},
    {""id"":""sableye"",""name"":""Sableye"",""types"":[""Dark"",""Ghost""],""atk"":141,""def"":136,""hp"":137,""fastMoves"":[""SHADOW_CLAW""],""chargedMoves"":[""FOUL_PLAY"",""SHADOW_BALL""]},
    {""id"":""talonflame"",""name"":""Talonflame"",""types"":[""Fire"",""Flying""],""atk"":176,""def"":155,""hp"":186,""fastMoves"":[""INCINERATE""],""chargedMoves"":[""BRAVE_BIRD"",""WEATHER_BALL_FIRE""]},
    {""id"":""lanturn"",""name"":""Lanturn"",""types"":[""Water"",""Electric""],""atk"":146,""def"":137,""hp"":268,""fastMoves"":[""VOLT_SWITCH""],""chargedMoves"":[""WILD_CHARGE"",""HYDRO_CANNON""]},
    {""id"":""registeel"",""name"":""Registeel"",""types"":[""Steel""],""atk"":143,""def"":285,""hp"":190,""fastMoves"":[""VOLT_SWITCH""],""chargedMoves"":[""FOCUS_BLAST"",""ZAP_CANNON""]},
    {""id"":""noctowl"",""name"":""Noctowl"",""types"":[""Normal"",""Flying""],""atk"":145,""def"":156,""hp"":225,""fastMoves"":[""WING_ATTACK""],""chargedMoves"":[""SKY_ATTACK"",""SHADOW_BALL""]},
    {""id"":""azumarill"",""name"":""Azumarill"",""types"":[""Water"",""Fairy""],""atk"":112,""def"":152,""hp"":225,""fastMoves"":[""BUBBLE""],""chargedMoves"":[""ICE_BEAM"",""PLAY_ROUGH""]},
    {""id"":""gliscor"",""name"":""Gliscor"",""types"":[""Ground"",""Flying""],""atk"":185,""def"":222,""hp"":181,""fastMoves"":[""WING_ATTACK""],""chargedMoves"":[""DRILL_RUN"",""NIGHT_SLASH""]}
  ]
}";
    }
}
