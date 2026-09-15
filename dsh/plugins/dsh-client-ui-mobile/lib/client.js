/**
 * Browser half. Turns the sidebar into a hamburger drawer on narrow screens.
 *
 * dsh runs each browser bundle through window.__ModuleLoader__.load, so the
 * wrapper below is required even for a plugin that is mostly CSS. No React,
 * no bundler, no build step.
 *
 * The CSS is kept in step with ../mobile.css by hand. That file is the copy
 * you paste into Stylus or Userscripts and it carries the full reasoning; this
 * one is the copy dsh serves. Edit one, edit the other.
 *
 * WHAT THIS USES RATHER THAN REPLACES
 * dsh already collapses the sidebar below 1024px (SIDEBAR_AUTO_COLLAPSE in
 * dsh-client-ui-layout) and renders a real toggle button that calls its own
 * toggleSidebar(). We never build a button or track open state: the CSS moves
 * dsh's button, and the one handler below forwards an outside tap to it. So a
 * dsh update can restyle or relabel that button and this keeps working.
 */
window.__ModuleLoader__.load({
  id: 'dsh-client-ui-mobile',
  factory: () => {
    const module = { exports: {} }

    // Matches dsh's own SIDEBAR_AUTO_COLLAPSE, so the drawer exists exactly
    // when dsh considers the viewport narrow. Two breakpoints would disagree.
    const NARROW = '(width < 1024px)'

    // Exactly one element in the tree carries both of these classes: the
    // sidebar's toggle button. Matched with *= and two attributes so neither a
    // build hash nor the order of the class list can break it.
    const TOGGLE = '[class*="_iconButton"][class*="_toggle"]'
    const SIDEBAR = '[class*="_sidebarCol"]'

    // The composer is a contenteditable div, not an input, so focusing it is
    // what raises the on-screen keyboard. The attribute is unhashed.
    const COMPOSER = '[data-composer-input]'

    const CSS = `
@media ${NARROW} {
  /* The sidebar leaves the grid; the conversation always gets the full width. */
  [class*="_frame"]:has(> ${SIDEBAR}) {
    grid-template-columns: 0 minmax(0, 1fr) 0 !important;
  }
  [class*="_frame"]:has(> ${SIDEBAR}) > ${SIDEBAR} { overflow: hidden !important; }

  /* Closed: dsh's own toggle, lifted out as a floating hamburger. position:
     fixed escapes the 0-width column because no ancestor sets transform,
     filter or contain, which are the only things that would trap it.
     Styled like the right-panel button at the other end of the row (28px,
     round, no border or fill, 15px icon). top 16px = 8px header padding plus
     the centring offset of 28px in the 44px row. */
  [data-sidebar-collapsed] ${TOGGLE} {
    position: fixed !important;
    inset: 16px auto auto 8px !important;
    width: 28px !important;
    height: 28px !important;
    z-index: 400 !important;
    border-radius: 50% !important;
    background: none !important;
    border: none !important;
    color: var(--dsw-alias-label-secondary) !important;
  }
  /* 28px is under a reliable thumb target; the pseudo-element grows the hit
     area to 44px without drawing anything. */
  [data-sidebar-collapsed] ${TOGGLE}::before {
    content: "";
    position: absolute;
    inset: -8px;
  }
  [data-sidebar-collapsed] ${TOGGLE} [class*="_panelIcon"] {
    width: 15px !important;
    height: 15px !important;
  }
  @media (pointer: coarse) {
    /* dsh reveals the icon on :hover, which never fires on a touchscreen, so
       the button would render as a blank mark. */
    [data-sidebar-collapsed] ${TOGGLE} [class*="_panelIcon"] { display: inline !important; }
    [data-sidebar-collapsed] ${TOGGLE} [class*="_railMark"]  { display: none !important; }
  }

  /* Open: a drawer over the conversation. The huge shadow spread is the dimmed
     backdrop, which saves injecting an element just to grey the page out. */
  [class*="_frame"]:has(> ${SIDEBAR}):not([data-sidebar-collapsed]) > ${SIDEBAR} {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    bottom: 0 !important;
    width: min(320px, 85vw) !important;
    z-index: 400 !important;
    overflow: auto !important;
    box-shadow: 0 0 0 100vmax var(--dsw-alias-bg-mask-1) !important;
  }

  /* A col-resize grip is useless without a mouse and overlays the drawer. */
  [class*="_handle"] { display: none !important; }

  /* The session header as two rows. dsh lays it out as one flex line with
     everything but the title at flex:none, so at 390px the title shrank to
     "Debugging ..." and the hamburger sat on its first two letters.
     Row 1: title (with the subagent switcher), "..." menu, right-panel button,
            44px tall to match the hamburger's tap zone; 36px of padding clears
            the 28px button with 8px to spare.
     Row 2: "N background jobs" when there are any; an empty grid row has no
            height, so it collapses otherwise.
     _titleCluster wraps the title and the actions; display:contents dissolves
     it so both join the grid directly. _titleRow, _titleCluster,
     _headerUtilities and _headerCorner hash to one class each in the bundle;
     _headerActions and _crumbs do not, hence the _titleRow scope. */
  [class*="_header"]:has(> [class*="_titleRow"]) {
    min-height: 0 !important;
    padding: 8px 8px 0 8px !important;
  }
  [class*="_titleRow"] {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto auto !important;
    grid-template-areas:
      "title more corner"
      "actions actions actions" !important;
    align-items: center !important;
    gap: 2px 8px !important;
    min-height: 44px !important;
  }
  [class*="_titleRow"] > [class*="_titleCluster"] { display: contents !important; }
  [class*="_titleRow"] [class*="_crumbs"] {
    grid-area: title !important;
    min-height: 44px !important;
    padding-left: 36px !important;
  }
  /* Only the title truncates; left to flex, the switcher read "2 subag". */
  [class*="_crumbs"] [data-slot="conversation.session.header.lineage"] > * {
    flex: none !important;
  }
  [class*="_titleRow"] [class*="_headerActions"] {
    grid-area: actions !important;
    flex-wrap: wrap !important;
  }
  /* The agent-preset label ("Standard mode") is a fact you cannot act on from
     the header. It is the one non-button in the actions slot; the jobs and
     schedule widgets both mount a button, so matching by shape keeps them. */
  [data-slot="conversation.session.header.actions"] > span:not(:has(button)) {
    display: none !important;
  }
  [class*="_titleRow"] > [class*="_headerUtilities"] {
    grid-area: more !important;
    margin-left: 0 !important;
  }
  [class*="_titleRow"] > [class*="_headerCorner"] {
    grid-area: corner !important;
    margin: 0 !important;
  }

  /* Open-in-app opens the workspace folder in an app on the machine running
     dsh, which from a phone is a button that does nothing you can see. The
     slot is a list, so it is matched by shape (a _split child), not position. */
  [data-slot="conversation.session.header.utilities"] > *:has([class*="_split"]) {
    display: none !important;
  }

  /* Reading margins are sized for a desktop. dsh insets the text twice over:
     12px on the scroll body, then another 32px on the message column. At 390px
     that left 293px of text and a blank rail down both sides. */
  [data-conversation-scroll] {
    padding-left: 6px !important;
    padding-right: 6px !important;
  }
  [data-conversation-scroll] [class*="_viewArea"] {
    width: 100% !important;
    max-width: none !important;
  }
  /* Exactly one element owns a _column child, so this reaches the 32px inset
     without naming a class dsh gives a fresh hash on every build. */
  [data-conversation-scroll] *:has(> [class*="_column"]) {
    padding-left: 8px !important;
    padding-right: 8px !important;
  }

  /* The composer sat 16px inside an already inset parent. Same fix, and it is
     also what gives the toolbar below the room it needs. */
  [class*="_root"]:has(> [class*="_card"] [data-composer-input]) {
    padding-left: 6px !important;
    padding-right: 6px !important;
  }

  /* The toolbar broke onto a second row whenever a turn was running, because a
     stop button appears beside send. Measured at 390px: the row needed 310px
     and had 309px. _trailing is flex: 0 0 auto, so rather than let its model
     label truncate it wrapped the whole group.
     8px gaps keep touch targets comfortably apart; letting _trailing shrink
     hands the squeeze back to dsh, which already collapses that label to an
     icon when space runs out. */
  [class*="_row"]:has(> [class*="_tools"]) {
    flex-wrap: nowrap !important;
    padding-left: 4px !important;
    padding-right: 4px !important;
    gap: 8px !important;
  }
  [class*="_row"]:has(> [class*="_tools"]) > [class*="_tools"],
  [class*="_row"]:has(> [class*="_tools"]) > [class*="_trailing"] {
    gap: 8px !important;
  }
  [class*="_row"]:has(> [class*="_tools"]) > [class*="_trailing"] {
    flex: 0 1 auto !important;
    min-width: 0 !important;
  }
  [class*="_trailing"] [class*="_trigger"] { min-width: 0 !important; }

  /* The question card and the plan-review card replace the composer while
     they are open. dsh insets each one 32px a side on top of the seat, so at
     393px the card was 305px wide and its bottom row (pager, Skip, Submit,
     none of them allowed to shrink) needed 338px. The card clips overflow,
     so Submit was simply gone. Both attributes are unhashed. 6px puts the
     card on the same edges as the composer it stands in for. */
  [data-question-key], [data-plan-review-key] {
    padding-left: 6px !important;
    padding-right: 6px !important;
  }
  /* The safety net: when the row still does not fit (320px phones, a large
     font setting, a longer label in some later dsh), the button group drops
     to its own line and keeps to the right, instead of vanishing. The group
     must also be allowed to shrink (dsh has it at flex: 0 0 auto), or the
     plan card's three buttons stay one 300px block and wrapping inside the
     group never happens; measured at 320px, Approve was still 25px outside. */
  [data-question-key] footer,
  [data-plan-review-key] [class*="_footer"]:has(> [class*="_actions"]) {
    flex-wrap: wrap !important;
  }
  [data-question-key] footer > [class*="_footerActions"],
  [data-plan-review-key] [class*="_footer"] > [class*="_actions"] {
    flex: 0 1 auto !important;
    min-width: 0 !important;
    flex-wrap: wrap !important;
    justify-content: flex-end !important;
    margin-left: auto !important;
  }

  /* Long code lines should scroll, not stretch the page sideways. */
  [data-conversation-scroll] pre {
    max-width: 100% !important;
    overflow-x: auto !important;
  }
}

@media (pointer: coarse) {
  /* iOS zooms the page when a focused input is under 16px and never zooms back. */
  input, textarea, [data-composer-input] { font-size: 16px !important; }

  /* dsh's Tooltip opens on mouseenter and on focus, and closes on mouseleave
   * and blur. A tap fires the two opening events and neither closing one, so
   * the bubble parks itself over the header until you tap somewhere else:
   * "Collapse sidebar" landed on the dsh wordmark, "Open sidebar" on the
   * conversation title. Nothing is lost by dropping it, because every trigger
   * also carries its own aria-label. role="tooltip" is a plain attribute
   * rather than a hashed class, so this outlives a dsh rebuild. */
  [role="tooltip"] { display: none !important; }
}`

    module.exports.name = 'dsh-client-ui-mobile'
    module.exports.apply = (ctx) => {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-client-ui-mobile'
      tag.textContent = CSS
      document.head.appendChild(tag)

      // Shared state for the three handlers below.
      // `settleUntil` is the short window after a drawer selection during which
      // the composer is not allowed to steal focus; `lastPointer` is the element
      // the user last touched, which is how we tell dsh's autofocus apart from
      // the user deliberately tapping the composer.
      let settleUntil = 0
      let lastPointer = null

      const open = () => {
        const sidebar = document.querySelector(SIDEBAR)
        if (!sidebar) return null
        const frame = sidebar.parentElement
        if (!frame || frame.hasAttribute('data-sidebar-collapsed')) return null
        return sidebar
      }
      const narrow = () => window.matchMedia(NARROW).matches

      // 1. Tap outside the open drawer to close it, the way a hamburger menu is
      // expected to behave. CSS cannot do this; there is no handler to hang a
      // :hover or :focus trick on.
      //
      // Capture phase, and the tap is swallowed: dismissing a drawer should not
      // also press whatever sits underneath it. Every condition is a reason to
      // stay out of the way, so the only tap consumed is one on a narrow screen,
      // with the drawer open, landing outside the drawer.
      const onPointerDown = (event) => {
        lastPointer = event.target
        if (!narrow()) return
        const sidebar = open()
        if (!sidebar) return
        if (sidebar.contains(event.target)) {
          // Arm the no-keyboard window here rather than on click, because by the
          // time a click reaches document it is already too late. Traced in a
          // real browser, tapping a conversation:
          //
          //   6921  pointerdown  row
          //   6933  click        row, capture phase
          //   6946  focusin      composer      <- dsh focuses it here
          //   6950  click        row, bubble   <- a document listener runs here
          //
          // React commits the session switch and runs the focus while the click
          // is still being dispatched inside the app, 4ms before the event
          // finishes bubbling out to us. Arming on click set the window after
          // the focus it was meant to suppress.
          settleUntil = Date.now() + 800
          return
        }
        const toggle = sidebar.querySelector(TOGGLE)
        if (!toggle) return
        event.preventDefault()
        event.stopPropagation()
        toggle.click()
      }

      // 2. Choosing something inside the drawer should close it too. Nothing in
      // dsh does this: only dsh-client-ui-layout knows about narrowExpanded, and
      // it clears the flag on a viewport change or when the right panel opens,
      // never on a selection. So picking a conversation left the drawer sitting
      // over the conversation you had just asked for.
      //
      // Bubble phase, and nothing is prevented: dsh must handle the click first
      // and actually switch session.
      //
      // A conversation row is <div role="treeitem">, not a button, not a link and
      // not role=button. A first version listed only those, so it matched every
      // rail control and none of the actual conversations, which is why the drawer
      // never shut on the one tap that mattered.
      //
      // role=treeitem alone is too broad the other way: the project folders
      // (for example dsh-mobile, Ungrouped) are treeitems as well, and expanding a
      // folder should leave the drawer open. Only conversations carry
      // aria-selected, so that tells the two apart without depending on a class
      // name dsh generates at build time.
      const CONVERSATION = '[role="treeitem"][aria-selected]'
      const onClick = (event) => {
        if (!narrow()) return
        const sidebar = open()
        if (!sidebar || !sidebar.contains(event.target)) return
        const control = event.target.closest?.(
          `button, a, [role="button"], [role="option"], [role="menuitem"], [role="tab"], ${CONVERSATION}`,
        )
        if (!control) return
        // The toggle already closes the drawer itself; acting here would reopen it.
        if (control.matches(TOGGLE)) return
        // Redundant after a tap, which arms the window on pointerdown, but it is
        // the only arming for a selection made with the keyboard.
        settleUntil = Date.now() + 800
        sidebar.querySelector(TOGGLE)?.click()
      }

      // 3. Keep the on-screen keyboard shut when the session changes.
      //
      // dsh-client-ui-conversation focuses the composer from an effect keyed on
      // sessionId:
      //
      //     useEffect(() => {
      //       if (locked || editor === null) return
      //       editor.getRootElement()?.focus({ preventScroll: true })
      //       editor.focus(() => { revealSelection() })
      //     }, [locked, sessionId, editor])
      //
      // Reasonable with a keyboard already on the desk. On a phone, picking a
      // conversation throws half the screen away before you have read a word of
      // it. This only fires inside the window opened by a drawer selection, only
      // on a touch screen, and only when the user did not tap the composer
      // themselves, so deliberately reaching for it still works.
      const onFocusIn = (event) => {
        if (Date.now() > settleUntil) return
        if (!window.matchMedia('(pointer: coarse)').matches) return
        const composer = event.target.closest?.(COMPOSER)
        if (!composer) return
        if (lastPointer && composer.contains(lastPointer)) return
        composer.blur()
      }

      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('click', onClick)
      document.addEventListener('focusin', onFocusIn)

      ctx.effect(() => () => {
        tag.remove()
        document.removeEventListener('pointerdown', onPointerDown, true)
        document.removeEventListener('click', onClick)
        document.removeEventListener('focusin', onFocusIn)
      }, 'mobile-drawer')
    }

    return module.exports
  },
})
