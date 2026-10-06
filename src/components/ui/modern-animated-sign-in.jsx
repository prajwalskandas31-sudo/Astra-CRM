import React, {
  memo,
  useState,
  useEffect,
  useRef,
  forwardRef,
} from 'react';
import {
  motion,
  useAnimation,
  useInView,
  useMotionTemplate,
  useMotionValue,
} from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Standard Image shim for Vite/React compatibility
const Image = ({ src, alt, width, height, className, ...props }) => (
  <img
    src={src}
    alt={alt || ''}
    width={width}
    height={height}
    className={className}
    {...props}
  />
);

// ==================== Label Component ====================

const Label = memo(function Label({ className, ...props }) {
  return (
    <label
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-neutral-300',
        className
      )}
      {...props}
    />
  );
});

Label.displayName = 'Label';

// ==================== BottomGradient Component ====================

const BottomGradient = () => {
  return (
    <>
      <span className='group-hover/btn:opacity-100 block transition duration-500 opacity-0 absolute h-px w-full -bottom-px inset-x-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent' />
      <span className='group-hover/btn:opacity-100 blur-sm block transition duration-500 opacity-0 absolute h-px w-1/2 mx-auto -bottom-px inset-x-10 bg-gradient-to-r from-transparent via-indigo-500 to-transparent' />
    </>
  );
};

// ==================== Input Component ====================

const Input = memo(
  forwardRef(function Input(
    { className, type, ...props },
    ref
  ) {
    const radius = 100; // change this to increase the radius of the hover effect
    const [visible, setVisible] = useState(false);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({
      currentTarget,
      clientX,
      clientY,
    }) {
      const { left, top } = currentTarget.getBoundingClientRect();

      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }

    return (
      <motion.div
        style={{
          background: useMotionTemplate`
        radial-gradient(
          ${visible ? radius + 'px' : '0px'} circle at ${mouseX}px ${mouseY}px,
          #6e56cf,
          transparent 80%
        )
      `,
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className='group/input rounded-lg p-[2px] transition duration-300 w-full'
      >
        <input
          type={type}
          className={cn(
            `shadow-input flex h-10 w-full rounded-md border border-neutral-800 bg-neutral-900/90 px-3 py-2 text-sm text-white transition duration-300 group-hover/input:shadow-none placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50`,
            className
          )}
          ref={ref}
          {...props}
        />
      </motion.div>
    );
  })
);

Input.displayName = 'Input';

// ==================== BoxReveal Component ====================

const BoxReveal = memo(function BoxReveal({
  children,
  width = 'fit-content',
  boxColor,
  duration,
  overflow = 'hidden',
  position = 'relative',
  className,
}) {
  const mainControls = useAnimation();
  const slideControls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      slideControls.start('visible');
      mainControls.start('visible');
    } else {
      slideControls.start('hidden');
      mainControls.start('hidden');
    }
  }, [isInView, mainControls, slideControls]);

  return (
    <section
      ref={ref}
      style={{
        position,
        width,
        overflow,
      }}
      className={className}
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 75 },
          visible: { opacity: 1, y: 0 },
        }}
        initial='hidden'
        animate={mainControls}
        transition={{ duration: duration ?? 0.5, delay: 0.25 }}
      >
        {children}
      </motion.div>
      <motion.div
        variants={{ hidden: { left: 0 }, visible: { left: '100%' } }}
        initial='hidden'
        animate={slideControls}
        transition={{ duration: duration ?? 0.5, ease: 'easeIn' }}
        style={{
          position: 'absolute',
          top: 4,
          bottom: 4,
          left: 0,
          right: 0,
          zIndex: 20,
          background: boxColor ?? '#6e56cf',
          borderRadius: 4,
        }}
      />
    </section>
  );
});

BoxReveal.displayName = 'BoxReveal';

// ==================== Ripple Component ====================

const Ripple = memo(function Ripple({
  mainCircleSize = 210,
  mainCircleOpacity = 0.24,
  numCircles = 11,
  className = '',
}) {
  return (
    <section
      className={`absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden
        [mask-image:linear-gradient(to_bottom,black,transparent)] ${className}`}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 70;
        const opacity = mainCircleOpacity - i * 0.02;
        const animationDelay = `${i * 0.08}s`;
        const borderStyle = i === numCircles - 1 ? 'dashed' : 'solid';
        const borderOpacity = Math.max(5, 25 - i * 2);

        return (
          <span
            key={i}
            className='absolute rounded-full border'
            style={{
              width: `${size}px`,
              height: `${size}px`,
              opacity: Math.max(0.04, opacity),
              animation: 'ripple 3s ease infinite',
              animationDelay: animationDelay,
              borderStyle: borderStyle,
              borderWidth: '1px',
              borderColor: `rgba(147, 197, 253, ${borderOpacity / 100})`,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}
    </section>
  );
});

Ripple.displayName = 'Ripple';

// ==================== OrbitingCircles Component ====================

const OrbitingCircles = memo(function OrbitingCircles({
  className,
  children,
  reverse = false,
  duration = 20,
  delay = 10,
  radius = 50,
  path = true,
}) {
  return (
    <>
      {path && (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          version='1.1'
          className='pointer-events-none absolute inset-0 size-full'
        >
          <circle
            className='stroke-white/10 stroke-1'
            cx='50%'
            cy='50%'
            r={radius}
            fill='none'
          />
        </svg>
      )}
      <section
        style={
          {
            '--duration': duration,
            '--radius': radius,
            '--delay': -delay,
          }
        }
        className={cn(
          'absolute flex size-full transform-gpu animate-orbit items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xs [animation-delay:calc(var(--delay)*1000ms)]',
          { '[animation-direction:reverse]': reverse },
          className
        )}
      >
        {children}
      </section>
    </>
  );
});

OrbitingCircles.displayName = 'OrbitingCircles';

// ==================== TechOrbitDisplay Component ====================

const TechOrbitDisplay = memo(function TechOrbitDisplay({
  iconsArray,
  text = 'Astra CRM',
}) {
  return (
    <section className='relative flex h-full w-full min-h-[480px] flex-col items-center justify-center overflow-hidden rounded-2xl'>
      <span className='pointer-events-none whitespace-pre-wrap bg-gradient-to-b from-white via-neutral-200 to-neutral-600 bg-clip-text text-center text-5xl md:text-6xl font-extrabold tracking-tight text-transparent select-none z-10'>
        {text}
      </span>
      <span className='text-xs font-semibold uppercase tracking-widest text-indigo-400/80 mt-2 z-10 select-none'>
        Enterprise RBAC Platform
      </span>

      {iconsArray.map((icon, index) => (
        <OrbitingCircles
          key={index}
          className={icon.className}
          duration={icon.duration}
          delay={icon.delay}
          radius={icon.radius}
          path={icon.path}
          reverse={icon.reverse}
        >
          {icon.component()}
        </OrbitingCircles>
      ))}
    </section>
  );
});

TechOrbitDisplay.displayName = 'TechOrbitDisplay';

// ==================== AnimatedForm Component ====================

const AnimatedForm = memo(function AnimatedForm({
  header,
  subHeader,
  fields,
  submitButton,
  textVariantButton,
  errorField,
  noticeField,
  fieldPerRow = 1,
  onSubmit,
  goTo,
  children,
}) {
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});

  const toggleVisibility = () => setVisible(!visible);

  const validateForm = (event) => {
    const currentErrors = {};
    fields.forEach((field) => {
      const inputEl = event.target[field.label];
      const value = field.value !== undefined ? field.value : inputEl?.value;

      if (field.required && !value) {
        currentErrors[field.label] = `${field.label} is required`;
      }
    });
    return currentErrors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const formErrors = validateForm(event);

    if (Object.keys(formErrors).length === 0) {
      onSubmit(event);
    } else {
      setErrors(formErrors);
    }
  };

  return (
    <section className='max-md:w-full flex flex-col gap-3 w-full max-w-[420px] mx-auto'>
      <BoxReveal boxColor='#6e56cf' duration={0.3}>
        <h2 className='font-bold text-3xl text-white tracking-tight'>
          {header}
        </h2>
      </BoxReveal>

      {subHeader && (
        <BoxReveal boxColor='#6e56cf' duration={0.3} className='pb-1'>
          <p className='text-neutral-400 text-sm max-w-sm'>
            {subHeader}
          </p>
        </BoxReveal>
      )}

      {children}

      <form onSubmit={handleSubmit} className='mt-2'>
        <section
          className={`grid grid-cols-1 md:grid-cols-${fieldPerRow} mb-3 gap-3`}
        >
          {fields.map((field) => (
            <section key={field.label} className='flex flex-col gap-1.5'>
              <BoxReveal boxColor='#6e56cf' duration={0.3}>
                <Label htmlFor={field.label}>
                  {field.label} {field.required && <span className='text-red-400'>*</span>}
                </Label>
              </BoxReveal>

              <BoxReveal
                width='100%'
                boxColor='#6e56cf'
                duration={0.3}
                className='flex flex-col space-y-1 w-full'
              >
                <section className='relative'>
                  <Input
                    type={
                      field.type === 'password'
                        ? visible
                          ? 'text'
                          : 'password'
                        : field.type
                    }
                    id={field.label}
                    name={field.label}
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={field.onChange}
                    autoComplete={field.type === 'password' ? 'current-password' : 'username'}
                  />

                  {field.type === 'password' && (
                    <button
                      type='button'
                      onClick={toggleVisibility}
                      className='absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-neutral-400 hover:text-white transition'
                    >
                      {visible ? (
                        <Eye className='h-4 w-4' />
                      ) : (
                        <EyeOff className='h-4 w-4' />
                      )}
                    </button>
                  )}
                </section>

                {errors[field.label] && (
                  <p className='text-red-400 text-xs mt-1'>
                    {errors[field.label]}
                  </p>
                )}
              </BoxReveal>
            </section>
          ))}
        </section>

        {noticeField && (
          <BoxReveal width='100%' boxColor='#6e56cf' duration={0.3}>
            <div className='bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs rounded-md p-2.5 mb-3'>
              {noticeField}
            </div>
          </BoxReveal>
        )}

        {errorField && (
          <BoxReveal width='100%' boxColor='#6e56cf' duration={0.3}>
            <div className='bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-md p-2.5 mb-3'>
              {errorField}
            </div>
          </BoxReveal>
        )}

        <BoxReveal
          width='100%'
          boxColor='#6e56cf'
          duration={0.3}
          overflow='visible'
        >
          <button
            className='bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 relative group/btn block w-full text-white rounded-lg h-11 font-semibold text-sm shadow-[0_0_20px_rgba(99,102,241,0.35)] outline-none hover:cursor-pointer transition duration-200 mt-2'
            type='submit'
          >
            <span className='flex items-center justify-center gap-2'>
              {submitButton} &rarr;
            </span>
            <BottomGradient />
          </button>
        </BoxReveal>

        {textVariantButton && goTo && (
          <BoxReveal boxColor='#6e56cf' duration={0.3}>
            <section className='mt-4 text-center'>
              <button
                type='button'
                className='text-xs text-indigo-400 hover:text-indigo-300 hover:underline outline-none'
                onClick={goTo}
              >
                {textVariantButton}
              </button>
            </section>
          </BoxReveal>
        )}
      </form>
    </section>
  );
});

AnimatedForm.displayName = 'AnimatedForm';

// ==================== AuthTabs Component ====================

const AuthTabs = memo(function AuthTabs({
  formFields,
  goTo,
  handleSubmit,
  children,
}) {
  return (
    <div className='flex justify-center w-full'>
      <div className='w-full flex flex-col justify-center items-center'>
        <AnimatedForm
          {...formFields}
          fieldPerRow={1}
          onSubmit={handleSubmit}
          goTo={goTo}
        >
          {children}
        </AnimatedForm>
      </div>
    </div>
  );
});

AuthTabs.displayName = 'AuthTabs';

// ==================== Exports ====================

export {
  Input,
  BoxReveal,
  Ripple,
  OrbitingCircles,
  TechOrbitDisplay,
  AnimatedForm,
  AuthTabs,
  Label,
  BottomGradient,
};
