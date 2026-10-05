/** Усі рядки інтерфейсу. Жодних хардкод-текстів у компонентах. */
export const uk = {
  app: { name: 'Grade Expectations' },
  roles: { TEACHER: 'Викладач', MODERATOR: 'Модератор' },
  login: {
    title: 'Вхід',
    subtitle: 'Електронний журнал і розклад коледжу',
    email: 'Електронна пошта',
    password: 'Пароль',
    submit: 'Увійти',
    submitting: 'Вхід…',
    google: 'Увійти через Google',
    or: 'або',
    invalidCredentials: 'Невірна пошта або пароль',
    unknownError: 'Не вдалося увійти. Спробуйте ще раз',
    emailInvalid: 'Введіть коректну адресу пошти',
    passwordShort: 'Пароль має містити щонайменше 8 символів',
    noSignUp: 'Облікові записи створює деканат',
  },
  menu: {
    account: 'Обліковий запис',
    role: 'Поточна роль',
    switchRole: 'Перемкнути роль',
    logout: 'Вийти',
  },
  today: {
    title: 'Сьогодні',
    welcome: 'Вітаємо',
    placeholder: 'Тут з’явиться ваш розклад на сьогодні.',
  },
  common: { loading: 'Завантаження…', loadError: 'Не вдалося завантажити дані' },
} as const;
