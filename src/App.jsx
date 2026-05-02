import { useMemo, useState } from 'react'
import './App.css'

// ---------- helpers ----------
const fmtUSD = (n) =>
  isFinite(n)
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '—'
const fmtUSD2 = (n) =>
  isFinite(n)
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    : '—'
const fmtPct = (n, d = 2) => (isFinite(n) ? `${(n * 100).toFixed(d)}%` : '—')
const fmtNum = (n, d = 2) => (isFinite(n) ? n.toFixed(d) : '—')
const num = (v) => {
  const n = parseFloat(v)
  return isFinite(n) ? n : 0
}

function monthlyPI(principal, annualRatePct, years) {
  const r = annualRatePct / 100 / 12
  const n = years * 12
  if (n <= 0) return 0
  if (r === 0) return principal / n
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function loanBalance(principal, annualRatePct, years, monthsPaid) {
  const r = annualRatePct / 100 / 12
  const n = years * 12
  if (monthsPaid >= n) return 0
  if (r === 0) return principal * (1 - monthsPaid / n)
  const pmt = monthlyPI(principal, annualRatePct, years)
  return principal * Math.pow(1 + r, monthsPaid) - pmt * ((Math.pow(1 + r, monthsPaid) - 1) / r)
}

function monthsAgo(isoDate) {
  if (!isoDate) return Infinity
  const d = new Date(isoDate)
  if (isNaN(d)) return Infinity
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

// ---------- inputs ----------
function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

function NumInput({ value, onChange, step = 1, min, max, prefix, suffix, placeholder }) {
  return (
    <span className="num-wrap">
      {prefix ? <span className="affix">{prefix}</span> : null}
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {suffix ? <span className="affix">{suffix}</span> : null}
    </span>
  )
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function DateInput({ value, onChange }) {
  return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
}

const newUnit = () => ({ sqft: 1000, beds: 2, baths: 1, rent: 2200, rehabDowntimeWeeks: 0 })
const newComp = () => ({
  address: '',
  sale_price: 0,
  sale_date: '',
  sqft: 0,
  distance: 0,
  notes: '',
})

// ---------- main ----------
export default function App() {
  // Subject
  const [subject, setSubject] = useState({ address: '', notes: '' })
  const [units, setUnits] = useState([newUnit(), newUnit()])

  // Comps — two sets: today (current condition) and after-repair (ARV)
  const [compsToday, setCompsToday] = useState([newComp()])
  const [compsARV, setCompsARV] = useState([newComp()])

  // Acquisition
  const [purchasePrice, setPurchasePrice] = useState(400000)
  const [closingCostsPct, setClosingCostsPct] = useState(2)
  const [capex, setCapex] = useState(10000)

  // Financing
  const [downPct, setDownPct] = useState(20)
  const [rate, setRate] = useState(7.0)
  const [term, setTerm] = useState(30)

  // Income
  const [vacancyPct, setVacancyPct] = useState(5)
  const [otherIncomeMonthly, setOtherIncomeMonthly] = useState(0)

  // Operating expenses
  const [taxes, setTaxes] = useState(5000)
  const [insurance, setInsurance] = useState(1800)
  const [hoa, setHoa] = useState(0)
  const [pmPct, setPmPct] = useState(8)
  const [maintPct, setMaintPct] = useState(5)
  const [electricity, setElectricity] = useState(0)
  const [water, setWater] = useState(0)
  const [trash, setTrash] = useState(0)
  const [lawn, setLawn] = useState(0)
  const [snow, setSnow] = useState(0)
  const [internet, setInternet] = useState(0)
  const [otherOpex, setOtherOpex] = useState(0)

  // Projections
  const [yearly, setYearly] = useState(
    Array.from({ length: 5 }, () => ({ rent_growth: 3, expense_growth: 3, appreciation: 3 }))
  )
  const [sellingCostsPct, setSellingCostsPct] = useState(6)

  // Thresholds
  const [thresholds, setThresholds] = useState({
    dscr_min: 1.2,
    coc_min: 7,
    cap_spread_min: 1,
    expense_ratio_min: 25,
    expense_ratio_max: 45,
  })

  // ---------- derived ----------
  const totalSqft = units.reduce((a, u) => a + num(u.sqft), 0)
  const totalBeds = units.reduce((a, u) => a + num(u.beds), 0)
  const totalBaths = units.reduce((a, u) => a + num(u.baths), 0)

  const closingCosts = (purchasePrice * closingCostsPct) / 100
  const downPayment = (purchasePrice * downPct) / 100
  const loanAmount = purchasePrice - downPayment
  const cashInvested = downPayment + closingCosts + capex

  const piMonthly = monthlyPI(loanAmount, rate, term)
  const annualDebtService = piMonthly * 12

  const grossRentMonthly = units.reduce((a, u) => a + num(u.rent), 0)
  const grossRentAnnual = grossRentMonthly * 12
  const otherIncomeAnnual = otherIncomeMonthly * 12
  const gpi = grossRentAnnual + otherIncomeAnnual
  const vacancyLoss = (gpi * vacancyPct) / 100
  // per-unit rehab downtime in weeks of year 1 (0–52, capped at one year per unit)
  const rehabDowntimeLoss = units.reduce(
    (a, u) => a + num(u.rent) * 12 * (Math.min(52, Math.max(0, num(u.rehabDowntimeWeeks))) / 52),
    0
  )
  const egi = gpi - vacancyLoss - rehabDowntimeLoss

  const pm = (egi * pmPct) / 100
  const maint = (egi * maintPct) / 100
  const utilitiesTotal = electricity + water + trash + lawn + snow + internet
  const totalOpex = taxes + insurance + hoa + pm + maint + utilitiesTotal + otherOpex
  const expenseRatio = egi > 0 ? totalOpex / egi : 0

  const noi = egi - totalOpex
  const cashFlow = noi - annualDebtService
  const capRate = noi / purchasePrice
  const cashOnCash = cashFlow / cashInvested
  const dscr = noi / annualDebtService

  const dscrPass = dscr >= thresholds.dscr_min
  const cocPass = cashOnCash * 100 >= thresholds.coc_min
  const cfPass = cashFlow > 0
  const capSpreadPass = capRate * 100 >= rate + thresholds.cap_spread_min
  const expenseRatioPct = expenseRatio * 100
  const expenseRatioPass =
    expenseRatioPct >= thresholds.expense_ratio_min &&
    expenseRatioPct <= thresholds.expense_ratio_max

  // Comp evaluation against current unit-mix totals
  const evalComps = (arr) =>
    arr.map((c) => {
      const distOk = num(c.distance) <= 0.5
      const dateOk = monthsAgo(c.sale_date) <= 6
      const sizeOk =
        totalSqft > 0 &&
        num(c.sqft) > 0 &&
        Math.abs(num(c.sqft) - totalSqft) / totalSqft <= 0.25
      const ppsf = num(c.sale_price) && num(c.sqft) ? num(c.sale_price) / num(c.sqft) : 0
      return { distOk, dateOk, sizeOk, ppsf, valid: distOk && dateOk && sizeOk }
    })

  const compResultsToday = evalComps(compsToday)
  const validPpsfsToday = compResultsToday.filter((r) => r.valid && r.ppsf).map((r) => r.ppsf)
  const avgPpsfToday =
    validPpsfsToday.length > 0
      ? validPpsfsToday.reduce((a, b) => a + b, 0) / validPpsfsToday.length
      : 0
  const impliedValueToday = avgPpsfToday * totalSqft
  const validCountToday = compResultsToday.filter((r) => r.valid).length

  const compResultsARV = evalComps(compsARV)
  const validPpsfsARV = compResultsARV.filter((r) => r.valid && r.ppsf).map((r) => r.ppsf)
  const avgPpsfARV =
    validPpsfsARV.length > 0
      ? validPpsfsARV.reduce((a, b) => a + b, 0) / validPpsfsARV.length
      : 0
  const impliedValueARV = avgPpsfARV * totalSqft
  const validCountARV = compResultsARV.filter((r) => r.valid).length

  const subjectPpsf = totalSqft > 0 ? purchasePrice / totalSqft : 0

  // Sell after Year 1 (using ARV)
  const arv = impliedValueARV > 0 ? impliedValueARV : 0
  const arvSellingCosts = arv * (sellingCostsPct / 100)
  const arvLoanBalance12 = loanBalance(loanAmount, rate, term, 12)
  const arvNetSaleProceeds = arv - arvSellingCosts - arvLoanBalance12
  const arvTotalReturn = cashFlow + arvNetSaleProceeds - cashInvested
  const arvROI = cashInvested > 0 && arv > 0 ? arvTotalReturn / cashInvested : 0
  const arvProfitable = arv > 0 && arvTotalReturn > 0
  const arvEquityMultiple = cashInvested > 0 && arv > 0
    ? (cashFlow + arvNetSaleProceeds) / cashInvested
    : 0

  const projection = useMemo(() => {
    const rows = []
    let rev = egi
    let opex = totalOpex
    let propVal = purchasePrice
    let cumCF = 0

    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        rev = rev * (1 + yearly[i].rent_growth / 100)
        opex = opex * (1 + yearly[i].expense_growth / 100)
      }
      propVal = propVal * (1 + yearly[i].appreciation / 100)
      const yNoi = rev - opex
      const yCF = yNoi - annualDebtService
      cumCF += yCF

      const monthsPaid = (i + 1) * 12
      const balance = loanBalance(loanAmount, rate, term, monthsPaid)
      const sellCosts = propVal * (sellingCostsPct / 100)
      const saleProceeds = propVal - sellCosts - balance
      const totalReturn = cumCF + saleProceeds - cashInvested
      const totalROI = totalReturn / cashInvested
      const equityMultiple = (cumCF + saleProceeds) / cashInvested
      const annualizedROI = Math.pow(1 + totalROI, 1 / (i + 1)) - 1

      const yDscr = annualDebtService > 0 ? yNoi / annualDebtService : 0
      const yCoc = cashInvested > 0 ? yCF / cashInvested : 0

      rows.push({
        year: i + 1,
        revenue: rev,
        opex,
        noi: yNoi,
        debtService: annualDebtService,
        cashFlow: yCF,
        cumCashFlow: cumCF,
        dscr: yDscr,
        coc: yCoc,
        propertyValue: propVal,
        loanBalance: balance,
        saleProceeds,
        totalROI,
        annualizedROI,
        equityMultiple,
      })
    }
    return rows
  }, [
    egi,
    totalOpex,
    purchasePrice,
    yearly,
    annualDebtService,
    loanAmount,
    rate,
    term,
    sellingCostsPct,
    cashInvested,
  ])

  const uses = [
    { label: 'Purchase Price', amount: purchasePrice },
    { label: 'Closing Costs', amount: closingCosts },
    { label: 'CapEx (Initial)', amount: capex },
  ]
  const totalUses = uses.reduce((a, b) => a + b.amount, 0)
  const sources = [
    { label: 'Loan Proceeds', amount: loanAmount },
    { label: 'Equity (Down + Closing + CapEx)', amount: cashInvested },
  ]
  const totalSources = sources.reduce((a, b) => a + b.amount, 0)

  // ---------- mutators ----------
  const updateUnit = (i, patch) =>
    setUnits((arr) => arr.map((u, idx) => (idx === i ? { ...u, ...patch } : u)))
  const addUnit = () => setUnits((arr) => (arr.length >= 4 ? arr : [...arr, newUnit()]))
  const removeUnit = (i) =>
    setUnits((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)))

  const compUpdater = (setter) => (i, patch) =>
    setter((arr) => arr.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const compAdder = (setter) => () => setter((arr) => [...arr, newComp()])
  const compRemover = (setter) => (i) => setter((arr) => arr.filter((_, idx) => idx !== i))

  const updateCompToday = compUpdater(setCompsToday)
  const addCompToday = compAdder(setCompsToday)
  const removeCompToday = compRemover(setCompsToday)
  const updateCompARV = compUpdater(setCompsARV)
  const addCompARV = compAdder(setCompsARV)
  const removeCompARV = compRemover(setCompsARV)

  const updateYear = (i, patch) =>
    setYearly((arr) => arr.map((y, idx) => (idx === i ? { ...y, ...patch } : y)))

  // ---------- comp table ----------
  const renderCompTable = (comps, results, update, remove) => (
    <div className="table-wrap">
      <table className="comps">
        <thead>
          <tr>
            <th>Address</th>
            <th>Sale Price</th>
            <th>Sale Date</th>
            <th>Sqft</th>
            <th>Distance (mi)</th>
            <th>$/sqft</th>
            <th>Dist</th>
            <th>≤6mo</th>
            <th>Size</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {comps.map((c, i) => {
            const r = results[i]
            return (
              <tr key={i} className={r.valid ? 'comp-valid' : 'comp-invalid'}>
                <td>
                  <TextInput value={c.address} onChange={(v) => update(i, { address: v })} />
                </td>
                <td>
                  <NumInput
                    value={c.sale_price}
                    onChange={(v) => update(i, { sale_price: num(v) })}
                    prefix="$"
                  />
                </td>
                <td>
                  <DateInput
                    value={c.sale_date}
                    onChange={(v) => update(i, { sale_date: v })}
                  />
                </td>
                <td>
                  <NumInput value={c.sqft} onChange={(v) => update(i, { sqft: num(v) })} />
                </td>
                <td>
                  <NumInput
                    value={c.distance}
                    step={0.1}
                    onChange={(v) => update(i, { distance: num(v) })}
                  />
                </td>
                <td className="mono">{r.ppsf ? fmtUSD(r.ppsf) : '—'}</td>
                <td className={`check ${r.distOk ? 'pass' : 'fail'}`}>
                  {r.distOk ? '✓' : '✗'}
                </td>
                <td className={`check ${r.dateOk ? 'pass' : 'fail'}`}>
                  {r.dateOk ? '✓' : '✗'}
                </td>
                <td className={`check ${r.sizeOk ? 'pass' : 'fail'}`}>
                  {r.sizeOk ? '✓' : '✗'}
                </td>
                <td>
                  <TextInput value={c.notes} onChange={(v) => update(i, { notes: v })} />
                </td>
                <td>
                  <button onClick={() => remove(i)} className="btn-x">
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Real Estate Quick Underwriting</h1>
        <p className="muted">
          1–4 unit residential. Comps → Acquisition → Year 1 → Projections.
        </p>
      </header>

      {/* SUBJECT PROPERTY */}
      <section>
        <h2>1. Subject Property</h2>
        <div className="grid g-2">
          <Field label="Address">
            <TextInput
              value={subject.address}
              onChange={(v) => setSubject({ ...subject, address: v })}
              placeholder="123 Main St"
            />
          </Field>
          <Field label="Notes">
            <TextInput
              value={subject.notes}
              onChange={(v) => setSubject({ ...subject, notes: v })}
              placeholder="features, condition, etc."
            />
          </Field>
        </div>

        <div className="table-wrap">
          <table className="unit-mix">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Sqft</th>
                <th>Bedrooms</th>
                <th>Bathrooms</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {units.map((u, i) => (
                <tr key={i}>
                  <td>#{i + 1}</td>
                  <td>
                    <NumInput
                      value={u.sqft}
                      onChange={(v) => updateUnit(i, { sqft: num(v) })}
                    />
                  </td>
                  <td>
                    <NumInput
                      value={u.beds}
                      onChange={(v) => updateUnit(i, { beds: num(v) })}
                    />
                  </td>
                  <td>
                    <NumInput
                      value={u.baths}
                      step={0.5}
                      onChange={(v) => updateUnit(i, { baths: num(v) })}
                    />
                  </td>
                  <td>
                    <button onClick={() => removeUnit(i)} className="btn-x">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="total">
                <td>Total ({units.length})</td>
                <td className="num">{totalSqft.toLocaleString()}</td>
                <td className="num">{totalBeds}</td>
                <td className="num">{totalBaths}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <button onClick={addUnit} className="btn" disabled={units.length >= 4}>
          + Add Unit
        </button>
      </section>

      {/* COMPARABLES */}
      <section>
        <h2>2. Comparables</h2>
        <p className="muted small">
          A comp validates if: within <strong>0.5 mi</strong>, sold within{' '}
          <strong>6 months</strong>, and size within <strong>±25%</strong> of subject (
          {totalSqft.toLocaleString()} sqft). Two sets: today's value (current condition) and
          after-repair value (ARV).
        </p>

        <h3 className="sub">Today's Comparables (current condition)</h3>
        {renderCompTable(compsToday, compResultsToday, updateCompToday, removeCompToday)}
        <button onClick={addCompToday} className="btn">
          + Add Today Comp
        </button>

        <h3 className="sub">After-Repair Comparables (ARV)</h3>
        {renderCompTable(compsARV, compResultsARV, updateCompARV, removeCompARV)}
        <button onClick={addCompARV} className="btn">
          + Add ARV Comp
        </button>

        <div className="kpis">
          <div className="kpi">
            <div className="kpi-label">Today: valid / total</div>
            <div className="kpi-val">
              {validCountToday} / {compsToday.length}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Today: avg $/sqft</div>
            <div className="kpi-val">{avgPpsfToday ? fmtUSD2(avgPpsfToday) : '—'}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Implied today value</div>
            <div className="kpi-val">{impliedValueToday ? fmtUSD(impliedValueToday) : '—'}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Subject $/sqft (at price)</div>
            <div className="kpi-val">{subjectPpsf ? fmtUSD2(subjectPpsf) : '—'}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">ARV: valid / total</div>
            <div className="kpi-val">
              {validCountARV} / {compsARV.length}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">ARV: avg $/sqft</div>
            <div className="kpi-val">{avgPpsfARV ? fmtUSD2(avgPpsfARV) : '—'}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Implied ARV</div>
            <div className="kpi-val">{impliedValueARV ? fmtUSD(impliedValueARV) : '—'}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">ARV uplift vs. price</div>
            <div className="kpi-val">
              {impliedValueARV
                ? fmtUSD(impliedValueARV - purchasePrice)
                : '—'}
            </div>
          </div>
        </div>
      </section>

      {/* ACQUISITION & FINANCING */}
      <section>
        <h2>3. Acquisition &amp; Financing</h2>
        <p className="muted small">
          Mortgage is modeled from down payment, rate, and term — do not enter a loan amount.
          Taxes and insurance are tracked separately as operating expenses (P&amp;I only, not full
          PITI).
        </p>
        <div className="grid g-3">
          <Field label="Purchase Price">
            <NumInput
              value={purchasePrice}
              onChange={(v) => setPurchasePrice(num(v))}
              prefix="$"
            />
          </Field>
          <Field label="Closing Costs" hint={fmtUSD(closingCosts)}>
            <NumInput
              value={closingCostsPct}
              step={0.25}
              onChange={(v) => setClosingCostsPct(num(v))}
              suffix="%"
            />
          </Field>
          <Field label="Initial CapEx / Rehab">
            <NumInput value={capex} onChange={(v) => setCapex(num(v))} prefix="$" />
          </Field>
          <Field label="Down Payment" hint={fmtUSD(downPayment)}>
            <NumInput
              value={downPct}
              step={0.5}
              onChange={(v) => setDownPct(num(v))}
              suffix="%"
            />
          </Field>
          <Field label="Interest Rate">
            <NumInput value={rate} step={0.05} onChange={(v) => setRate(num(v))} suffix="%" />
          </Field>
          <Field label="Loan Term">
            <NumInput value={term} onChange={(v) => setTerm(num(v))} suffix="yr" />
          </Field>
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-label">Loan Amount</div>
            <div className="kpi-val">{fmtUSD(loanAmount)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Monthly P&amp;I</div>
            <div className="kpi-val">{fmtUSD2(piMonthly)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Annual Debt Service</div>
            <div className="kpi-val">{fmtUSD(annualDebtService)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Total Cash to Close</div>
            <div className="kpi-val">{fmtUSD(cashInvested)}</div>
          </div>
        </div>
      </section>

      {/* INCOME */}
      <section>
        <h2>4. Income</h2>
        <p className="muted small">
          Rehab downtime is per unit in weeks the unit is offline during year 1 (0–52; a unit
          cannot lose more than one year of rent).
        </p>
        <div className="table-wrap">
          <table className="unit-mix">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Monthly Rent</th>
                <th>Rehab Downtime (weeks, ≤52)</th>
                <th>Year-1 rent loss</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u, i) => {
                const wk = Math.min(52, Math.max(0, num(u.rehabDowntimeWeeks)))
                const loss = num(u.rent) * 12 * (wk / 52)
                return (
                  <tr key={i}>
                    <td>#{i + 1}</td>
                    <td>
                      <NumInput
                        value={u.rent}
                        onChange={(v) => updateUnit(i, { rent: num(v) })}
                        prefix="$"
                      />
                    </td>
                    <td>
                      <NumInput
                        value={u.rehabDowntimeWeeks}
                        step={1}
                        min={0}
                        max={52}
                        onChange={(v) =>
                          updateUnit(i, {
                            rehabDowntimeWeeks: Math.min(52, Math.max(0, num(v))),
                          })
                        }
                        suffix="wk"
                      />
                    </td>
                    <td className="num">{fmtUSD(loss)}</td>
                  </tr>
                )
              })}
              <tr className="total">
                <td>Total</td>
                <td className="num">{fmtUSD(grossRentMonthly)}</td>
                <td></td>
                <td className="num">{fmtUSD(rehabDowntimeLoss)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid g-3">
          <Field label="Vacancy">
            <NumInput
              value={vacancyPct}
              step={0.5}
              onChange={(v) => setVacancyPct(num(v))}
              suffix="%"
            />
          </Field>
          <Field label="Other Income (mo)">
            <NumInput
              value={otherIncomeMonthly}
              onChange={(v) => setOtherIncomeMonthly(num(v))}
              prefix="$"
            />
          </Field>
        </div>
        <div className="table-wrap">
          <table className="summary">
            <tbody>
              <tr>
                <td>Gross Rent (annual)</td>
                <td className="num">{fmtUSD(grossRentAnnual)}</td>
              </tr>
              <tr>
                <td>+ Other Income</td>
                <td className="num">{fmtUSD(otherIncomeAnnual)}</td>
              </tr>
              <tr>
                <td>Gross Potential Income</td>
                <td className="num">{fmtUSD(gpi)}</td>
              </tr>
              <tr>
                <td>− Vacancy ({vacancyPct}%)</td>
                <td className="num">−{fmtUSD(vacancyLoss)}</td>
              </tr>
              <tr>
                <td>− Rehab Downtime (per unit)</td>
                <td className="num">−{fmtUSD(rehabDowntimeLoss)}</td>
              </tr>
              <tr className="total">
                <td>Effective Gross Income</td>
                <td className="num">{fmtUSD(egi)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* OPERATING EXPENSES */}
      <section>
        <h2>5. Operating Expenses (annual)</h2>
        <div className="grid g-4 compact">
          <Field label="Property Taxes">
            <NumInput value={taxes} onChange={(v) => setTaxes(num(v))} prefix="$" />
          </Field>
          <Field label="Insurance">
            <NumInput value={insurance} onChange={(v) => setInsurance(num(v))} prefix="$" />
          </Field>
          <Field label="HOA">
            <NumInput value={hoa} onChange={(v) => setHoa(num(v))} prefix="$" />
          </Field>
          <Field label="Property Mgmt" hint={`${fmtUSD(pm)} of EGI`}>
            <NumInput
              value={pmPct}
              step={0.5}
              onChange={(v) => setPmPct(num(v))}
              suffix="% EGI"
            />
          </Field>
          <Field label="Maint / Repairs" hint={`${fmtUSD(maint)} of EGI`}>
            <NumInput
              value={maintPct}
              step={0.5}
              onChange={(v) => setMaintPct(num(v))}
              suffix="% EGI"
            />
          </Field>
          <Field label="Electricity">
            <NumInput value={electricity} onChange={(v) => setElectricity(num(v))} prefix="$" />
          </Field>
          <Field label="Water">
            <NumInput value={water} onChange={(v) => setWater(num(v))} prefix="$" />
          </Field>
          <Field label="Trash">
            <NumInput value={trash} onChange={(v) => setTrash(num(v))} prefix="$" />
          </Field>
          <Field label="Lawn">
            <NumInput value={lawn} onChange={(v) => setLawn(num(v))} prefix="$" />
          </Field>
          <Field label="Snow">
            <NumInput value={snow} onChange={(v) => setSnow(num(v))} prefix="$" />
          </Field>
          <Field label="Internet">
            <NumInput value={internet} onChange={(v) => setInternet(num(v))} prefix="$" />
          </Field>
          <Field label="Other">
            <NumInput value={otherOpex} onChange={(v) => setOtherOpex(num(v))} prefix="$" />
          </Field>
        </div>
        <div className="table-wrap">
          <table className="summary">
            <tbody>
              <tr>
                <td>Property Taxes</td>
                <td className="num">{fmtUSD(taxes)}</td>
              </tr>
              <tr>
                <td>Insurance</td>
                <td className="num">{fmtUSD(insurance)}</td>
              </tr>
              <tr>
                <td>HOA</td>
                <td className="num">{fmtUSD(hoa)}</td>
              </tr>
              <tr>
                <td>Property Management ({pmPct}% EGI)</td>
                <td className="num">{fmtUSD(pm)}</td>
              </tr>
              <tr>
                <td>Maintenance / Repairs ({maintPct}% EGI)</td>
                <td className="num">{fmtUSD(maint)}</td>
              </tr>
              <tr>
                <td>Electricity</td>
                <td className="num">{fmtUSD(electricity)}</td>
              </tr>
              <tr>
                <td>Water</td>
                <td className="num">{fmtUSD(water)}</td>
              </tr>
              <tr>
                <td>Trash</td>
                <td className="num">{fmtUSD(trash)}</td>
              </tr>
              <tr>
                <td>Lawn</td>
                <td className="num">{fmtUSD(lawn)}</td>
              </tr>
              <tr>
                <td>Snow</td>
                <td className="num">{fmtUSD(snow)}</td>
              </tr>
              <tr>
                <td>Internet</td>
                <td className="num">{fmtUSD(internet)}</td>
              </tr>
              <tr>
                <td>Other</td>
                <td className="num">{fmtUSD(otherOpex)}</td>
              </tr>
              <tr className="total">
                <td>Total Operating Expenses</td>
                <td className="num">{fmtUSD(totalOpex)}</td>
              </tr>
              <tr className={`total ${expenseRatioPass ? 'pass' : 'fail'}`}>
                <td>Expense Ratio (OpEx / EGI)</td>
                <td className="num">{fmtPct(expenseRatio)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* THRESHOLDS */}
      <section>
        <h2>6. Thresholds</h2>
        <div className="grid g-3">
          <Field label="Min DSCR">
            <NumInput
              value={thresholds.dscr_min}
              step={0.05}
              onChange={(v) => setThresholds({ ...thresholds, dscr_min: num(v) })}
            />
          </Field>
          <Field label="Min Cash-on-Cash">
            <NumInput
              value={thresholds.coc_min}
              step={0.5}
              onChange={(v) => setThresholds({ ...thresholds, coc_min: num(v) })}
              suffix="%"
            />
          </Field>
          <Field label="Cap Rate Spread Above Rate">
            <NumInput
              value={thresholds.cap_spread_min}
              step={0.25}
              onChange={(v) => setThresholds({ ...thresholds, cap_spread_min: num(v) })}
              suffix="%"
            />
          </Field>
          <Field label="Min Expense Ratio">
            <NumInput
              value={thresholds.expense_ratio_min}
              step={1}
              onChange={(v) => setThresholds({ ...thresholds, expense_ratio_min: num(v) })}
              suffix="%"
            />
          </Field>
          <Field label="Max Expense Ratio">
            <NumInput
              value={thresholds.expense_ratio_max}
              step={1}
              onChange={(v) => setThresholds({ ...thresholds, expense_ratio_max: num(v) })}
              suffix="%"
            />
          </Field>
        </div>
      </section>

      {/* YEAR 1 SUMMARY */}
      <section>
        <h2>7. Year 1 Underwriting</h2>
        <div className="table-wrap">
          <table className="summary">
            <tbody>
              <tr>
                <td>Gross Potential Income</td>
                <td className="num">{fmtUSD(gpi)}</td>
              </tr>
              <tr>
                <td>− Vacancy ({vacancyPct}%)</td>
                <td className="num">−{fmtUSD(vacancyLoss)}</td>
              </tr>
              <tr>
                <td>− Rehab Downtime (per unit)</td>
                <td className="num">−{fmtUSD(rehabDowntimeLoss)}</td>
              </tr>
              <tr className="total">
                <td>Effective Gross Income</td>
                <td className="num">{fmtUSD(egi)}</td>
              </tr>
              <tr>
                <td>− Operating Expenses</td>
                <td className="num">−{fmtUSD(totalOpex)}</td>
              </tr>
              <tr className="total">
                <td>Net Operating Income (NOI)</td>
                <td className="num">{fmtUSD(noi)}</td>
              </tr>
              <tr>
                <td>− Debt Service (P&amp;I)</td>
                <td className="num">−{fmtUSD(annualDebtService)}</td>
              </tr>
              <tr className={`total ${cfPass ? 'pass' : 'fail'}`}>
                <td>Cash Flow</td>
                <td className="num">{fmtUSD(cashFlow)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="kpis k-5">
          <div className={`kpi ${capSpreadPass ? 'pass' : 'fail'}`}>
            <div className="kpi-label">
              Cap Rate{' '}
              <span className="muted small">
                (≥ {rate}% + {thresholds.cap_spread_min}%)
              </span>
            </div>
            <div className="kpi-val">{fmtPct(capRate)}</div>
          </div>
          <div className={`kpi ${cocPass ? 'pass' : 'fail'}`}>
            <div className="kpi-label">
              Cash-on-Cash <span className="muted small">(≥ {thresholds.coc_min}%)</span>
            </div>
            <div className="kpi-val">{fmtPct(cashOnCash)}</div>
          </div>
          <div className={`kpi ${dscrPass ? 'pass' : 'fail'}`}>
            <div className="kpi-label">
              DSCR <span className="muted small">(≥ {thresholds.dscr_min})</span>
            </div>
            <div className="kpi-val">{fmtNum(dscr)}</div>
          </div>
          <div className={`kpi ${expenseRatioPass ? 'pass' : 'fail'}`}>
            <div className="kpi-label">
              Expense Ratio{' '}
              <span className="muted small">
                ({thresholds.expense_ratio_min}–{thresholds.expense_ratio_max}%)
              </span>
            </div>
            <div className="kpi-val">{fmtPct(expenseRatio)}</div>
          </div>
          <div className={`kpi ${cfPass ? 'pass' : 'fail'}`}>
            <div className="kpi-label">Cash Flow / mo</div>
            <div className="kpi-val">{fmtUSD(cashFlow / 12)}</div>
          </div>
        </div>
      </section>

      {/* SELL AFTER YEAR 1 */}
      <section>
        <h2>8. Sell After Year 1 (using ARV)</h2>
        <p className="muted small">
          What if you sell at the end of year 1 at the after-repair value? Uses the implied ARV
          from Section 2 ({impliedValueARV ? fmtUSD(impliedValueARV) : 'enter ARV comps'}),
          year-1 cash flow, the loan balance after 12 payments, and selling costs.
        </p>
        {arv > 0 ? (
          <>
            <div className="table-wrap">
              <table className="summary">
                <tbody>
                  <tr>
                    <td>After-Repair Value (ARV)</td>
                    <td className="num">{fmtUSD(arv)}</td>
                  </tr>
                  <tr>
                    <td>− Selling Costs ({sellingCostsPct}%)</td>
                    <td className="num">−{fmtUSD(arvSellingCosts)}</td>
                  </tr>
                  <tr>
                    <td>− Loan Balance (after 12 mo)</td>
                    <td className="num">−{fmtUSD(arvLoanBalance12)}</td>
                  </tr>
                  <tr className="total">
                    <td>Net Sale Proceeds</td>
                    <td className="num">{fmtUSD(arvNetSaleProceeds)}</td>
                  </tr>
                  <tr>
                    <td>+ Year 1 Cash Flow</td>
                    <td className="num">{fmtUSD(cashFlow)}</td>
                  </tr>
                  <tr>
                    <td>− Cash Invested (Down + Closing + CapEx)</td>
                    <td className="num">−{fmtUSD(cashInvested)}</td>
                  </tr>
                  <tr className={`total ${arvProfitable ? 'pass' : 'fail'}`}>
                    <td>Profit / (Loss)</td>
                    <td className="num">{fmtUSD(arvTotalReturn)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="kpis">
              <div className={`kpi ${arvProfitable ? 'pass' : 'fail'}`}>
                <div className="kpi-label">Profitable on sale?</div>
                <div className="kpi-val">{arvProfitable ? 'Yes' : 'No'}</div>
              </div>
              <div className={`kpi ${arvProfitable ? 'pass' : 'fail'}`}>
                <div className="kpi-label">ROI on sale</div>
                <div className="kpi-val">{fmtPct(arvROI)}</div>
              </div>
              <div className={`kpi ${arvProfitable ? 'pass' : 'fail'}`}>
                <div className="kpi-label">Equity Multiple</div>
                <div className="kpi-val">{fmtNum(arvEquityMultiple)}x</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">ARV uplift over price</div>
                <div className="kpi-val">{fmtUSD(arv - purchasePrice)}</div>
              </div>
            </div>
          </>
        ) : (
          <p className="muted small">Add valid after-repair comparables in Section 2 to see the sale scenario.</p>
        )}
      </section>

      {/* PROJECTIONS */}
      <section>
        <h2>9. 5-Year Projections</h2>
        <p className="muted small">
          Each year column assumes a hypothetical sale at the end of that year. Adjust growth and
          appreciation per year.
        </p>
        <Field label="Selling Costs (on sale)">
          <NumInput
            value={sellingCostsPct}
            step={0.5}
            onChange={(v) => setSellingCostsPct(num(v))}
            suffix="%"
          />
        </Field>

        <div className="table-wrap">
          <table className="projections">
            <thead>
              <tr>
                <th></th>
                {projection.map((p) => (
                  <th key={p.year}>Year {p.year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Rent Growth</td>
                {yearly.map((y, i) => (
                  <td key={i}>
                    <NumInput
                      value={y.rent_growth}
                      step={0.5}
                      onChange={(v) => updateYear(i, { rent_growth: num(v) })}
                      suffix="%"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td>Expense Growth</td>
                {yearly.map((y, i) => (
                  <td key={i}>
                    <NumInput
                      value={y.expense_growth}
                      step={0.5}
                      onChange={(v) => updateYear(i, { expense_growth: num(v) })}
                      suffix="%"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td>Appreciation</td>
                {yearly.map((y, i) => (
                  <td key={i}>
                    <NumInput
                      value={y.appreciation}
                      step={0.5}
                      onChange={(v) => updateYear(i, { appreciation: num(v) })}
                      suffix="%"
                    />
                  </td>
                ))}
              </tr>
              <tr className="sep">
                <td>Revenue (EGI)</td>
                {projection.map((p) => (
                  <td key={p.year} className="num">
                    {fmtUSD(p.revenue)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Operating Expenses</td>
                {projection.map((p) => (
                  <td key={p.year} className="num">
                    {fmtUSD(p.opex)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>NOI</td>
                {projection.map((p) => (
                  <td key={p.year} className="num">
                    {fmtUSD(p.noi)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Debt Service</td>
                {projection.map((p) => (
                  <td key={p.year} className="num">
                    {fmtUSD(p.debtService)}
                  </td>
                ))}
              </tr>
              <tr className="total">
                <td>Cash Flow</td>
                {projection.map((p) => (
                  <td key={p.year} className={`num ${p.cashFlow > 0 ? 'pass' : 'fail'}`}>
                    {fmtUSD(p.cashFlow)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Cumulative Cash Flow</td>
                {projection.map((p) => (
                  <td key={p.year} className="num">
                    {fmtUSD(p.cumCashFlow)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>DSCR (≥ {thresholds.dscr_min})</td>
                {projection.map((p) => (
                  <td
                    key={p.year}
                    className={`num ${p.dscr >= thresholds.dscr_min ? 'pass' : 'fail'}`}
                  >
                    {fmtNum(p.dscr)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Cash-on-Cash (≥ {thresholds.coc_min}%)</td>
                {projection.map((p) => (
                  <td
                    key={p.year}
                    className={`num ${p.coc * 100 >= thresholds.coc_min ? 'pass' : 'fail'}`}
                  >
                    {fmtPct(p.coc)}
                  </td>
                ))}
              </tr>
              <tr className="sep">
                <td>Property Value (sale)</td>
                {projection.map((p) => (
                  <td key={p.year} className="num">
                    {fmtUSD(p.propertyValue)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Loan Balance</td>
                {projection.map((p) => (
                  <td key={p.year} className="num">
                    {fmtUSD(p.loanBalance)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Net Sale Proceeds</td>
                {projection.map((p) => (
                  <td key={p.year} className="num">
                    {fmtUSD(p.saleProceeds)}
                  </td>
                ))}
              </tr>
              <tr className="total">
                <td>Total ROI (if sold)</td>
                {projection.map((p) => (
                  <td key={p.year} className={`num ${p.totalROI > 0 ? 'pass' : 'fail'}`}>
                    {fmtPct(p.totalROI)}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Annualized ROI</td>
                {projection.map((p) => (
                  <td key={p.year} className="num">
                    {fmtPct(p.annualizedROI)}
                  </td>
                ))}
              </tr>
              <tr className="total">
                <td>Equity Multiple</td>
                {projection.map((p) => (
                  <td key={p.year} className="num">
                    {fmtNum(p.equityMultiple)}x
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SOURCES & USES */}
      <section>
        <h2>10. Sources &amp; Uses</h2>
        <div className="grid g-2">
          <div className="table-wrap">
            <table className="sources-uses">
              <thead>
                <tr>
                  <th colSpan={3}>Sources</th>
                </tr>
                <tr>
                  <th></th>
                  <th>Amount</th>
                  <th>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, i) => (
                  <tr key={i}>
                    <td>{s.label}</td>
                    <td className="num">{fmtUSD(s.amount)}</td>
                    <td className="num">
                      {totalSources > 0 ? fmtPct(s.amount / totalSources, 1) : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Total Sources</td>
                  <td className="num">{fmtUSD(totalSources)}</td>
                  <td className="num">100.0%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <table className="sources-uses">
              <thead>
                <tr>
                  <th colSpan={3}>Uses</th>
                </tr>
                <tr>
                  <th></th>
                  <th>Amount</th>
                  <th>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {uses.map((u, i) => (
                  <tr key={i}>
                    <td>{u.label}</td>
                    <td className="num">{fmtUSD(u.amount)}</td>
                    <td className="num">
                      {totalUses > 0 ? fmtPct(u.amount / totalUses, 1) : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Total Uses</td>
                  <td className="num">{fmtUSD(totalUses)}</td>
                  <td className="num">100.0%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {Math.abs(totalSources - totalUses) > 1 ? (
          <p className="fail-text">
            Sources and Uses out of balance: {fmtUSD(totalSources - totalUses)}
          </p>
        ) : (
          <p className="pass-text">Sources and Uses balance.</p>
        )}
      </section>
    </div>
  )
}
